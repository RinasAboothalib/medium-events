import React, { useState } from 'react';
import { ApiError, api } from '../lib/api';
import { MIN_PASSWORD_LENGTH } from '../lib/staffValidation';

const FIELD =
  'w-full rounded-md border border-line bg-white px-3.5 py-2.5 text-base text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand';

// Changes the signed-in person's own password. Used for the forced first change and from My account.
export function PasswordForm({ onSaved }: { onSaved: () => void | Promise<void> }) {
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) return setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
    if (password !== confirm) return setError("Passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/change-password', { current_password: current, new_password: password });
      setCurrent('');
      setPassword('');
      setConfirm('');
      await onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Your password couldn't be saved. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="current-password" className="block text-sm font-semibold text-ink mb-1.5">Current password</label>
        <input id="current-password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={FIELD} />
      </div>
      <div>
        <label htmlFor="new-password" className="block text-sm font-semibold text-ink mb-1.5">New password</label>
        <input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={FIELD} />
        <p className="mt-1 text-xs text-muted">At least {MIN_PASSWORD_LENGTH} characters.</p>
      </div>
      <div>
        <label htmlFor="confirm-password" className="block text-sm font-semibold text-ink mb-1.5">Confirm new password</label>
        <input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={FIELD} />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60 cursor-pointer"
      >
        Save password
      </button>
    </form>
  );
}
