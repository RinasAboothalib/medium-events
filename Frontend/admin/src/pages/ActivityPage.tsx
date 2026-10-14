import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { listStaff } from '../lib/staff';
import { ACTION_LABELS, PAGE_SIZE, actionLabel, entityLabel, formatWhen, listActivity, summariseChanges, type ActivityFilters } from '../lib/activity';
import type { ActivityRow, StaffMember } from '../lib/types';

const FIELD =
  'w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand';
const PAGER =
  'rounded-md border border-line bg-white px-3 py-1.5 text-sm font-semibold text-ink hover:border-brand disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-brand cursor-pointer';

export default function ActivityPage() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const [filters, setFilters] = useState<ActivityFilters>({ page: 0 });
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [total, setTotal] = useState(0);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Only admins can filter by person
  useEffect(() => {
    if (isAdmin) listStaff().then(setStaff, () => setStaff([]));
  }, [isAdmin]);

  useEffect(() => {
    let cancelled = false;
    listActivity(filters).then(
      (result) => {
        if (cancelled) return;
        setRows(result.rows);
        setTotal(result.total);
        setError(null);
      },
      (e: Error) => !cancelled && setError(e.message),
    );
    return () => {
      cancelled = true;
    };
  }, [filters]);

  // The server joins the actor's name; a missing name means the account no longer exists
  const who = (row: ActivityRow) => (!row.actor_id ? 'System' : (row.actor_name ?? 'Former staff'));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Any filter change starts again from the first page
  const setFilter = (patch: Partial<ActivityFilters>) => setFilters((f) => ({ ...f, ...patch, page: 0 }));

  return (
    <section>
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">Activity log</h1>
      <p className="mt-1 text-body">{isAdmin ? 'Every change made in the admin system.' : 'Showing your own activity.'}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isAdmin && (
          <div>
            <label htmlFor="f-person" className="block text-sm font-semibold text-ink mb-1.5">Person</label>
            <select id="f-person" value={filters.actorId ?? ''} onChange={(e) => setFilter({ actorId: e.target.value || undefined })} className={FIELD}>
              <option value="">Everyone</option>
              {staff.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="f-action" className="block text-sm font-semibold text-ink mb-1.5">Action</label>
          <select id="f-action" value={filters.action ?? ''} onChange={(e) => setFilter({ action: e.target.value || undefined })} className={FIELD}>
            <option value="">All actions</option>
            {Object.entries(ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-from" className="block text-sm font-semibold text-ink mb-1.5">From</label>
          <input id="f-from" type="date" value={filters.from ?? ''} onChange={(e) => setFilter({ from: e.target.value || undefined })} className={FIELD} />
        </div>
        <div>
          <label htmlFor="f-to" className="block text-sm font-semibold text-ink mb-1.5">To</label>
          <input id="f-to" type="date" value={filters.to ?? ''} onChange={(e) => setFilter({ to: e.target.value || undefined })} className={FIELD} />
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-6 text-sm text-red-700">
          {error}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-surface text-left text-xs font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th scope="col" className="px-4 py-3">When (Maldives time)</th>
                <th scope="col" className="px-4 py-3">Who</th>
                <th scope="col" className="px-4 py-3">Action</th>
                <th scope="col" className="px-4 py-3">Area</th>
                <th scope="col" className="px-4 py-3">Changes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 whitespace-nowrap text-body">{formatWhen(row.at)}</td>
                  <td className="px-4 py-3 font-medium text-ink">{who(row)}</td>
                  <td className="px-4 py-3 text-body">{actionLabel(row.action)}</td>
                  <td className="px-4 py-3 text-body">{entityLabel(row.entity)}</td>
                  <td className="px-4 py-3 text-body break-words">{summariseChanges(row)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">
                    No activity matches these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-body">
        <span>
          Page {filters.page + 1} of {pages}
        </span>
        <div className="flex gap-2">
          <button type="button" className={PAGER} disabled={filters.page === 0} onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}>
            Previous page
          </button>
          <button type="button" className={PAGER} disabled={filters.page + 1 >= pages} onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}>
            Next page
          </button>
        </div>
      </div>
    </section>
  );
}
