import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { ROLE_LABELS } from '../lib/types';
import { PasswordForm } from '../components/PasswordForm';

export default function AccountPage() {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);

  return (
    <section className="max-w-md">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">My account</h1>
      {user && (
        <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted">Name</dt>
          <dd className="font-medium text-ink">{user.full_name}</dd>
          <dt className="text-muted">Email</dt>
          <dd className="font-medium text-ink break-all">{user.email}</dd>
          <dt className="text-muted">Role</dt>
          <dd className="font-medium text-ink">{ROLE_LABELS[user.role]}</dd>
        </dl>
      )}

      <h2 className="mt-10 mb-4 text-lg font-semibold text-ink">Change password</h2>
      {saved && (
        <p role="status" className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Password changed.
        </p>
      )}
      <div className="rounded-lg border border-line bg-white p-6">
        <PasswordForm onSaved={() => setSaved(true)} />
      </div>
      <p className="mt-3 text-xs text-muted">Changing your password signs you out on your other devices.</p>
    </section>
  );
}
