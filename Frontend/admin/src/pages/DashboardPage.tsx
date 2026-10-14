import { Link } from 'react-router';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { navFor } from '../lib/permissions';
import { useLoad } from '../lib/useLoad';
import { ROLE_LABELS } from '../lib/types';

const DESCRIPTIONS: Record<string, string> = {
  events: 'Event series and editions: programme, delegates, tasks and budget.',
  publish: 'Update the website with the latest events.',
  enquiries: 'Leads from the website and enquiries taken by phone or in person.',
  sponsors: 'Sponsor companies and their contacts.',
  deals: 'Sponsorship deals per event, payments and what is outstanding.',
  reports: 'Post-event, sponsorship and enquiry reports as PDF or Excel.',
  staff: 'Add staff, change roles and deactivate accounts.',
  activity: 'See who changed what, and when.',
  account: 'Your details and password.',
};

type Card = { id: string; label: string; value: string };

export default function DashboardPage() {
  const { user, role } = useAuth();
  const firstName = user?.full_name.split(' ')[0] ?? '';
  const shortcuts = navFor(role).filter((item) => item.id !== 'dashboard');
  // Figures for this role, worked out by the server (money only for roles allowed to see it)
  const { data } = useLoad(() => api.get<{ cards: Card[] }>('/dashboard'), []);

  return (
    <section>
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">Welcome, {firstName}</h1>
      <p className="mt-1 text-body">Signed in as {role && ROLE_LABELS[role]}</p>

      {data && data.cards.length > 0 && (
        <section aria-labelledby="glance-title" className="mt-8">
          <h2 id="glance-title" className="text-lg font-semibold text-ink">At a glance</h2>
          <dl className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.cards.map((card) => (
              <div key={card.id} className="rounded-lg border border-line bg-white p-5">
                <dt className="text-sm text-body">{card.label}</dt>
                <dd className="mt-1 text-xl font-bold tracking-tight text-ink break-words">{card.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shortcuts.map((item) => (
          <Link
            key={item.id}
            to={item.path}
            className="block rounded-lg border border-line bg-white p-5 hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <h2 className="text-base font-semibold text-ink">{item.label}</h2>
            <p className="mt-1 text-sm text-body">{DESCRIPTIONS[item.id]}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
