import { useNavigate } from 'react-router';
import { useAuth } from '../lib/auth';
import { PasswordForm } from '../components/PasswordForm';

// Shown after signing in with a temporary password (the default admin, a new account or an admin reset).
// The server refuses everything else until the password is changed.
export default function ChangePasswordPage() {
  const { refresh, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-line bg-white p-8">
        <h1 className="text-2xl font-bold text-ink">Choose a new password</h1>
        <p className="mt-2 mb-6 text-sm text-body">You signed in with a temporary password. Choose your own to continue.</p>
        <PasswordForm
          onSaved={async () => {
            await refresh();
            navigate('/', { replace: true });
          }}
        />
        <button type="button" onClick={signOut} className="mt-4 text-sm font-semibold text-brand hover:text-brand-hover cursor-pointer">
          Sign out
        </button>
      </div>
    </main>
  );
}
