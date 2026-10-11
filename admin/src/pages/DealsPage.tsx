import { useState } from 'react';
import { Link } from 'react-router';
import { Plus } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { listEditions } from '../lib/events';
import { can } from '../lib/permissions';
import { DEAL_STATUS_LABELS, formatMoney, listDeals } from '../lib/sales';
import { useLoad } from '../lib/useLoad';
import { DealsTable } from '../components/DealsTable';
import { FIELD, Loading, PageHeader, PRIMARY, TABLE_WRAP, TD, TH } from '../components/ui';

export default function DealsPage() {
  const { role } = useAuth();
  const [filter, setFilter] = useState<{ edition_id?: string; status?: string }>({});
  const { data, error } = useLoad(() => listDeals(filter), [JSON.stringify(filter)]);
  const { data: editions } = useLoad(() => listEditions(), []);

  return (
    <section>
      <PageHeader
        title="Deals"
        intro={can(role, 'deals.readAmounts') ? 'Sponsorship and exhibition deals per event, with payments received.' : 'Sponsorship and exhibition deals per event.'}
      >
        {can(role, 'deals.write') && (
          <Link to="/deals/new" className={PRIMARY}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            Add deal
          </Link>
        )}
      </PageHeader>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label htmlFor="f-edition" className="block text-sm font-semibold text-ink mb-1.5">Event</label>
          <select id="f-edition" value={filter.edition_id ?? ''} onChange={(e) => setFilter((f) => ({ ...f, edition_id: e.target.value || undefined }))} className={FIELD}>
            <option value="">All events</option>
            {(editions ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-status" className="block text-sm font-semibold text-ink mb-1.5">Status</label>
          <select id="f-status" value={filter.status ?? ''} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value || undefined }))} className={FIELD}>
            <option value="">All statuses</option>
            {Object.entries(DEAL_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-6 text-sm text-red-700">{error}</p>
      ) : !data ? (
        <Loading />
      ) : (
        <>
          {data.totals && (
            <section aria-labelledby="totals-title" className="mt-6">
              <h2 id="totals-title" className="text-lg font-semibold text-ink">Totals</h2>
              <p className="mt-1 text-sm text-muted">Proposed and confirmed deals; cancelled deals are left out. Each currency is totalled separately.</p>
              <div className={TABLE_WRAP}>
                <table className="w-full min-w-[480px] text-sm">
                  <thead className="bg-surface text-left text-xs font-semibold uppercase tracking-wider text-muted">
                    <tr>
                      <th scope="col" className={TH}>Currency</th>
                      <th scope="col" className={`${TH} text-right`}>Deals</th>
                      <th scope="col" className={`${TH} text-right`}>Received</th>
                      <th scope="col" className={`${TH} text-right`}>Outstanding</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.totals.map((t) => (
                      <tr key={t.currency}>
                        <th scope="row" className={`${TD} text-left font-semibold text-ink`}>{t.currency}</th>
                        <td className={`${TD} text-right whitespace-nowrap`}>{formatMoney(t.amount, t.currency)}</td>
                        <td className={`${TD} text-right whitespace-nowrap`}>{formatMoney(t.paid, t.currency)}</td>
                        <td className={`${TD} text-right whitespace-nowrap`}>{formatMoney(t.outstanding, t.currency)}</td>
                      </tr>
                    ))}
                    {data.totals.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-4 text-center text-muted">
                          Nothing to total yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          <DealsTable deals={data.rows} />
        </>
      )}
    </section>
  );
}
