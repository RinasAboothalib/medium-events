import { useState } from 'react';
import { Link } from 'react-router';
import { Plus } from 'lucide-react';
import { listEnquiries, PAGE_SIZE, SOURCE_LABELS, STATUS_LABELS, type EnquiryFilters } from '../lib/enquiries';
import { listStaff } from '../lib/staff';
import { can } from '../lib/permissions';
import { formatWhen } from '../lib/dates';
import { useLoad } from '../lib/useLoad';
import { FIELD, LINK, Loading, PageHeader, PRIMARY, SECONDARY, TABLE_WRAP, TD, TH } from '../components/ui';

export const STATUS_STYLES: Record<string, string> = {
  new: 'bg-brand-tint text-brand',
  contacted: 'bg-amber-50 text-amber-800',
  proposal_sent: 'bg-amber-50 text-amber-800',
  won: 'bg-green-50 text-green-800',
  lost: 'bg-surface text-muted',
};

export default function EnquiriesPage() {
  const [filters, setFilters] = useState<EnquiryFilters & { page: number }>({ page: 0 });
  const { data, error } = useLoad(() => listEnquiries(filters), [JSON.stringify(filters)]);
  const { data: staff } = useLoad(listStaff, []);
  // Any filter change starts again from the first page
  const setFilter = (patch: Partial<EnquiryFilters>) => setFilters((f) => ({ ...f, ...patch, page: 0 }));
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  const select = (id: string, label: string, key: keyof EnquiryFilters, options: [string, string][], all: string) => (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-ink mb-1.5">{label}</label>
      <select id={id} value={(filters[key] as string) ?? ''} onChange={(e) => setFilter({ [key]: e.target.value || undefined })} className={FIELD}>
        <option value="">{all}</option>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <section>
      <PageHeader title="Enquiries" intro="Leads from the website form, phone, WhatsApp, email and walk-ins.">
        <Link to="/enquiries/new" className={PRIMARY}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          Add enquiry
        </Link>
      </PageHeader>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label htmlFor="f-q" className="block text-sm font-semibold text-ink mb-1.5">Search</label>
          <input id="f-q" type="search" placeholder="Name, company, email or phone" value={filters.q ?? ''} onChange={(e) => setFilter({ q: e.target.value || undefined })} className={FIELD} />
        </div>
        {select('f-status', 'Status', 'status', Object.entries(STATUS_LABELS), 'All statuses')}
        {select('f-source', 'Source', 'source', Object.entries(SOURCE_LABELS), 'All sources')}
        {select('f-assignee', 'Assigned to', 'assignee', (staff ?? []).filter((p) => can(p.role, 'enquiries.access')).map((p) => [p.id, p.full_name]), 'Anyone')}
        <div className="grid grid-cols-2 gap-2 lg:col-span-2">
          <div>
            <label htmlFor="f-from" className="block text-sm font-semibold text-ink mb-1.5">From</label>
            <input id="f-from" type="date" value={filters.from ?? ''} onChange={(e) => setFilter({ from: e.target.value || undefined })} className={FIELD} />
          </div>
          <div>
            <label htmlFor="f-to" className="block text-sm font-semibold text-ink mb-1.5">To</label>
            <input id="f-to" type="date" value={filters.to ?? ''} onChange={(e) => setFilter({ to: e.target.value || undefined })} className={FIELD} />
          </div>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-6 text-sm text-red-700">{error}</p>
      ) : !data ? (
        <Loading />
      ) : (
        <div className={TABLE_WRAP}>
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-surface text-left text-xs font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th scope="col" className={TH}>Received</th>
                <th scope="col" className={TH}>Name</th>
                <th scope="col" className={TH}>Company</th>
                <th scope="col" className={TH}>Interested in</th>
                <th scope="col" className={TH}>Source</th>
                <th scope="col" className={TH}>Status</th>
                <th scope="col" className={TH}>Assigned to</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.rows.map((q) => (
                <tr key={q.id}>
                  <td className={`${TD} whitespace-nowrap text-body`}>{formatWhen(q.created_at)}</td>
                  <td className={TD}>
                    <Link to={`/enquiries/${q.id}`} className={LINK}>
                      {q.full_name}
                    </Link>
                  </td>
                  <td className={`${TD} text-body`}>{q.company}</td>
                  <td className={`${TD} text-body`}>{q.event || q.service}</td>
                  <td className={`${TD} text-body`}>{SOURCE_LABELS[q.source]}</td>
                  <td className={TD}>
                    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${STATUS_STYLES[q.status]}`}>{STATUS_LABELS[q.status]}</span>
                  </td>
                  <td className={`${TD} text-body`}>{q.assignee_name ?? '—'}</td>
                </tr>
              ))}
              {data.rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted">
                    No enquiries match these filters.
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
          <button type="button" className={SECONDARY} disabled={filters.page === 0} onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}>
            Previous page
          </button>
          <button type="button" className={SECONDARY} disabled={filters.page + 1 >= pages} onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}>
            Next page
          </button>
        </div>
      </div>
    </section>
  );
}
