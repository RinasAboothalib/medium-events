import { Link } from 'react-router';
import { Plus } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { listSeries } from '../lib/events';
import { can } from '../lib/permissions';
import { useLoad } from '../lib/useLoad';
import { Loading, PageHeader, PRIMARY, TABLE_WRAP, TD, TH, LINK } from '../components/ui';

export const READ_ONLY_EVENTS = 'You can view events. Only admins and the events team can change them.';

export default function EventsPage() {
  const { role } = useAuth();
  const canWrite = can(role, 'events.write');
  const { data: series, error } = useLoad(listSeries, []);

  return (
    <section>
      <PageHeader title="Events" intro="MEDIUM's event series. Open a series to edit it, its partners and its editions.">
        {canWrite && (
          <Link to="/events/new" className={PRIMARY}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            Add series
          </Link>
        )}
      </PageHeader>
      {!canWrite && <p className="mt-4 text-sm text-muted">{READ_ONLY_EVENTS}</p>}

      {error ? (
        <p role="alert" className="mt-6 text-sm text-red-700">
          {error}
        </p>
      ) : !series ? (
        <Loading />
      ) : (
        <div className={TABLE_WRAP}>
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-surface text-left text-xs font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th scope="col" className={TH}>Series</th>
                <th scope="col" className={TH}>Short name</th>
                <th scope="col" className={TH}>Editions</th>
                <th scope="col" className={TH}>On website</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {series.map((s) => (
                <tr key={s.id}>
                  <td className={TD}>
                    <Link to={`/events/${s.id}`} className={LINK}>
                      {s.name}
                    </Link>
                  </td>
                  <td className={`${TD} text-body`}>{s.short_name}</td>
                  <td className={`${TD} text-body`}>{s.edition_count}</td>
                  <td className={TD}>
                    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${s.active ? 'bg-green-50 text-green-800' : 'bg-surface text-muted'}`}>
                      {s.active ? 'Shown' : 'Hidden'}
                    </span>
                  </td>
                </tr>
              ))}
              {series.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted">
                    No series yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
