import { Link } from 'react-router';
import { DEAL_STATUS_LABELS, formatMoney, outstandingText } from '../lib/sales';
import type { Deal } from '../lib/types';
import { LINK, TABLE_WRAP, TD, TH } from './ui';

const STATUS_STYLES = { proposed: 'bg-amber-50 text-amber-800', confirmed: 'bg-green-50 text-green-800', cancelled: 'bg-surface text-muted' };

// Deals with money columns only when the server sent amounts (it never does for the events team)
export function DealsTable({ deals, showSponsor = true }: { deals: Deal[]; showSponsor?: boolean }) {
  const money = deals.some((d) => d.amount !== undefined);
  const columns = 3 + (showSponsor ? 1 : 0) + (money ? 3 : 0);
  return (
    <div className={TABLE_WRAP}>
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-surface text-left text-xs font-semibold uppercase tracking-wider text-muted">
          <tr>
            <th scope="col" className={TH}>Package</th>
            {showSponsor && <th scope="col" className={TH}>Sponsor</th>}
            <th scope="col" className={TH}>Event</th>
            <th scope="col" className={TH}>Status</th>
            {money && (
              <>
                <th scope="col" className={`${TH} text-right`}>Amount</th>
                <th scope="col" className={`${TH} text-right`}>Received</th>
                <th scope="col" className={`${TH} text-right`}>Outstanding</th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {deals.map((d) => (
            <tr key={d.id}>
              <td className={TD}>
                <Link to={`/deals/${d.id}`} className={LINK}>
                  {d.package}
                </Link>
              </td>
              {showSponsor && <td className={`${TD} text-body`}>{d.sponsor_company}</td>}
              <td className={`${TD} text-body`}>{d.edition_name}</td>
              <td className={TD}>
                <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[d.status]}`}>{DEAL_STATUS_LABELS[d.status]}</span>
              </td>
              {money && (
                <>
                  <td className={`${TD} text-right whitespace-nowrap text-ink`}>{formatMoney(d.amount!, d.currency!)}</td>
                  <td className={`${TD} text-right whitespace-nowrap text-body`}>{formatMoney(d.paid!, d.currency!)}</td>
                  <td className={`${TD} text-right whitespace-nowrap text-body`}>{d.status === 'cancelled' ? '—' : outstandingText(d.outstanding!, d.currency!)}</td>
                </>
              )}
            </tr>
          ))}
          {deals.length === 0 && (
            <tr>
              <td colSpan={columns} className="px-4 py-8 text-center text-muted">
                No deals yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
