import React, { useEffect, useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../lib/auth';
import type { StaffRole } from '../lib/types';

// Guards signed-in pages. Re-checks the user on every navigation so a deactivation or role
// change made by an admin takes effect without the user signing in again.
export const RequireAuth: React.FC<{ roles?: StaffRole[]; children?: React.ReactNode }> = ({ roles, children }) => {
  const { user, loading, refresh } = useAuth();
  const { pathname } = useLocation();
  const firstPath = useRef(pathname);

  useEffect(() => {
    if (pathname !== firstPath.current) {
      firstPath.current = pathname;
      refresh();
    }
  }, [pathname, refresh]);

  if (loading) return <p className="p-8 text-sm text-muted">Loading…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: pathname }} />;
  // Someone still on a temporary password must choose their own before using anything else
  if (user.must_change_password && pathname !== '/change-password') return <Navigate to="/change-password" replace />;
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-ink">You don't have access to this page</h1>
        <p className="mt-2 text-body">Ask a MEDIUM admin if you need it.</p>
      </div>
    );
  }
  return children ? <>{children}</> : <Outlet />;
};
