import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, api, onApiError } from './api';
import type { SessionUser, StaffRole } from './types';

export const SESSION_ENDED_MESSAGE = 'Your session has ended. Sign in again.';

interface AuthValue {
  user: SessionUser | null;
  role: StaffRole | null;
  loading: boolean;
  notice: string | null;
  signIn(email: string, password: string): Promise<string | null>;
  signOut(): Promise<void>;
  // Re-reads the signed-in user, so role changes and deactivations take effect without signing in again
  refresh(): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const signedIn = useRef(false);

  const applyUser = useCallback((next: SessionUser | null) => {
    signedIn.current = next !== null;
    setUser(next);
  }, []);

  const refresh = useCallback(async () => {
    try {
      applyUser(await api.get<SessionUser>('/auth/me'));
    } catch (e) {
      // A 401 is handled by the listener below; other failures (server down) keep the current state
      if (!(e instanceof ApiError) || e.status !== 401) return;
    } finally {
      setLoading(false);
    }
  }, [applyUser]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Any request can find the session gone (expired, deactivated, reset by an admin)
  // or the password change still pending.
  useEffect(
    () =>
      onApiError((error) => {
        if (error.status === 401 && signedIn.current) {
          applyUser(null);
          setNotice(SESSION_ENDED_MESSAGE);
        } else if (error.status === 401) {
          applyUser(null);
        } else if (error.status === 403 && error.message === 'password_change_required') {
          refresh();
        }
      }),
    [applyUser, refresh],
  );

  const value = useMemo<AuthValue>(
    () => ({
      user,
      role: user?.role ?? null,
      loading,
      notice,
      async signIn(email, password) {
        setNotice(null);
        try {
          await api.post('/auth/login', { email, password });
          applyUser(await api.get<SessionUser>('/auth/me'));
          return null;
        } catch (e) {
          return e instanceof ApiError ? e.message : 'Something went wrong. Try again.';
        }
      },
      async signOut() {
        setNotice(null);
        try {
          await api.post('/auth/logout');
        } finally {
          applyUser(null);
        }
      },
      refresh,
    }),
    [user, loading, notice, applyUser, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
