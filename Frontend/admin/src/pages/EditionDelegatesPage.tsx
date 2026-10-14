import React, { useState } from 'react';
import { useParams } from 'react-router';
import { Download } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { formatWhen } from '../lib/dates';
import {
  checkIn,
  DELEGATE_CATEGORY_LABELS,
  DELEGATE_PAGE_SIZE,
  DELEGATE_STATUS_LABELS,
  deleteDelegate,
  listDelegates,
  saveDelegate,
  undoCheckIn,
  type DelegateFilters,
} from '../lib/operations';
import { can } from '../lib/permissions';
import { useLoad } from '../lib/useLoad';
import type { Delegate, DelegateCategory, DelegateStatus } from '../lib/types';
import { EditionSection } from '../components/EditionTabs';
import { Confirm, FIELD, Field, Loading, Notice, PRIMARY, SECONDARY, TABLE_WRAP, TD, TH, type Message } from '../components/ui';

const STATUS_STYLES: Record<DelegateStatus, string> = {
  invited: 'bg-surface text-muted',
  registered: 'bg-brand-tint text-brand',
  confirmed: 'bg-amber-50 text-amber-800',
  attended: 'bg-green-50 text-green-800',
  cancelled: 'bg-surface text-muted',
  no_show: 'bg-red-50 text-red-800',
};

type Form = Record<'full_name' | 'company' | 'job_title' | 'email' | 'phone' | 'notes', string> & { category: DelegateCategory; status: DelegateStatus };
const EMPTY: Form = { full_name: '', company: '', job_title: '', email: '', phone: '', notes: '', category: 'delegate', status: 'registered' };

// /events/editions/:id/delegates — who is coming to an edition, with check-in at the door
export default function EditionDelegatesPage() {
  const { id = '' } = useParams();
  const { role } = useAuth();
  const canWrite = can(role, 'delegates.write');
  const [filters, setFilters] = useState<DelegateFilters>({ page: 0 });
  const { data, error, reload } = useLoad(() => listDelegates(id, filters), [id, JSON.stringify(filters)]);
  const [form, setForm] = useState<Form>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<Message>(null);
  const [deleting, setDeleting] = useState<Delegate | null>(null);

  // Any filter change starts again from the first page
  const setFilter = (patch: Partial<DelegateFilters>) => setFilters((f) => ({ ...f, ...patch, page: 0 }));
  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / DELEGATE_PAGE_SIZE));

  const edit = (g: Delegate) => {
    setEditing(g.id);
    setFields({});
    setMessage(null);
    setForm({ full_name: g.full_name, company: g.company, job_title: g.job_title, email: g.email, phone: g.phone, notes: g.notes, category: g.category, status: g.status });
  };
  const cancel = () => {
    setEditing(null);
    setFields({});
    setForm(EMPTY);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await saveDelegate(editing, editing ? form : { ...form, edition_id: id });
    setFields(result.ok ? {} : (result.fields ?? {}));
    setMessage(result.ok ? { kind: 'success', text: editing ? 'Saved.' : `${result.value.full_name} added.` } : { kind: 'error', text: result.error });
    if (!result.ok) return;
    cancel();
    await reload();
  };

  const act = async (run: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string) => {
    const result = await run();
    setMessage(result.ok ? { kind: 'success', text: done } : { kind: 'error', text: result.error });
    await reload();
  };

  const remove = async () => {
    const g = deleting!;
    setDeleting(null);
    if (editing === g.id) cancel();
    await act(() => deleteDelegate(g.id), `${g.full_name} removed.`);
  };

  const select = (elementId: string, label: string, key: 'status' | 'category', options: Record<string, string>, all: string) => (
    <div>
      <label htmlFor={elementId} className="block text-sm font-semibold text-ink mb-1.5">{label}</label>
      <select id={elementId} value={filters[key] ?? ''} onChange={(e) => setFilter({ [key]: e.target.value || undefined })} className={FIELD}>
        <option value="">{all}</option>
        {Object.entries(options).map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );

  const summary = data?.summary;
  const expected = summary ? summary.total - summary.by_status.cancelled : 0;

  return (
    <EditionSection
      editionId={id}
      intro="Delegate register: who is coming, and check-in at the door."
      actions={
        can(role, 'reports.delegates') && (
          <a href={`/api/reports/delegates.xlsx?edition_id=${id}`} download className={SECONDARY}>
            <Download className="w-4 h-4" aria-hidden="true" />
            Download Excel
          </a>
        )
      }
    >
      {() => (
        <>
          {!canWrite && <p className="mt-4 text-sm text-muted">You can view delegates. Only admins and the events team can change them.</p>}
          {summary && (
            <dl aria-label="Register summary" className="mt-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
              {[
                ['On the register', summary.total],
                ['Expected', expected],
                ['Checked in', summary.checked_in],
                ['Cancelled', summary.by_status.cancelled],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-line bg-white p-4">
                  <dt className="text-sm text-body">{label}</dt>
                  <dd className="mt-1 text-xl font-bold tracking-tight text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <label htmlFor="g-q" className="block text-sm font-semibold text-ink mb-1.5">Search</label>
              <input id="g-q" type="search" placeholder="Name, company, email or phone" value={filters.q ?? ''} onChange={(e) => setFilter({ q: e.target.value || undefined })} className={FIELD} />
            </div>
            {select('g-status', 'Status', 'status', DELEGATE_STATUS_LABELS, 'All statuses')}
            {select('g-category', 'Category', 'category', DELEGATE_CATEGORY_LABELS, 'All categories')}
          </div>

          <Notice message={message} />
          {deleting && (
            <Confirm
              title={`Remove ${deleting.full_name} from the register?`}
              detail="This can't be undone. To keep a record, set the status to Cancelled instead."
              confirmLabel={`Yes, remove ${deleting.full_name}`}
              onConfirm={remove}
              onCancel={() => setDeleting(null)}
            />
          )}

          {error ? (
            <p role="alert" className="mt-6 text-sm text-red-700">{error}</p>
          ) : !data ? (
            <Loading />
          ) : (
            <div className={TABLE_WRAP}>
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-surface text-left text-xs font-semibold uppercase tracking-wider text-muted">
                  <tr>
                    <th scope="col" className={TH}>Name</th>
                    <th scope="col" className={TH}>Company</th>
                    <th scope="col" className={TH}>Contact</th>
                    <th scope="col" className={TH}>Category</th>
                    <th scope="col" className={TH}>Status</th>
                    {canWrite && <th scope="col" className={TH}><span className="sr-only">Actions</span></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.rows.map((g) => (
                    <tr key={g.id}>
                      <td className={TD}>
                        <span className="font-medium text-ink">{g.full_name}</span>
                        {g.job_title && <span className="block text-xs text-muted">{g.job_title}</span>}
                      </td>
                      <td className={`${TD} text-body`}>{g.company}</td>
                      <td className={`${TD} text-body`}>
                        {g.email}
                        {g.email && g.phone && <br />}
                        {g.phone}
                      </td>
                      <td className={`${TD} text-body`}>{DELEGATE_CATEGORY_LABELS[g.category]}</td>
                      <td className={TD}>
                        <span className={`rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${STATUS_STYLES[g.status]}`}>{DELEGATE_STATUS_LABELS[g.status]}</span>
                        {g.checked_in_at && <span className="block mt-1 text-xs text-muted whitespace-nowrap">In at {formatWhen(g.checked_in_at)}</span>}
                      </td>
                      {canWrite && (
                        <td className={`${TD} text-right whitespace-nowrap`}>
                          <span className="inline-flex gap-2">
                            {g.checked_in_at ? (
                              <button type="button" className={SECONDARY} aria-label={`Undo check-in of ${g.full_name}`} onClick={() => act(() => undoCheckIn(g.id), `Check-in of ${g.full_name} undone.`)}>
                                Undo check-in
                              </button>
                            ) : (
                              g.status !== 'cancelled' && (
                                <button type="button" className={SECONDARY} aria-label={`Check in ${g.full_name}`} onClick={() => act(() => checkIn(g.id), `${g.full_name} checked in.`)}>
                                  Check in
                                </button>
                              )
                            )}
                            <button type="button" className={SECONDARY} aria-label={`Edit ${g.full_name}`} onClick={() => edit(g)}>
                              Edit
                            </button>
                            <button type="button" className={SECONDARY} aria-label={`Remove ${g.full_name}`} onClick={() => setDeleting(g)}>
                              Remove
                            </button>
                          </span>
                        </td>
                      )}
                    </tr>
                  ))}
                  {data.rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted">
                        {summary?.total ? 'No delegates match these filters.' : 'No delegates yet.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {pages > 1 && (
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
          )}

          {canWrite && (
            <form onSubmit={submit} noValidate aria-label={editing ? 'Edit delegate' : 'Add delegate'} className="mt-6 rounded-lg border border-line bg-white p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <h2 className="sm:col-span-2 lg:col-span-4 text-lg font-semibold text-ink">{editing ? 'Edit delegate' : 'Add delegate'}</h2>
              <Field id="g-name" label="Full name" error={fields.full_name}>
                <input value={form.full_name} onChange={set('full_name')} className={FIELD} />
              </Field>
              <Field id="g-company" label="Company" error={fields.company}>
                <input value={form.company} onChange={set('company')} className={FIELD} />
              </Field>
              <Field id="g-job" label="Job title" error={fields.job_title}>
                <input value={form.job_title} onChange={set('job_title')} className={FIELD} />
              </Field>
              <Field id="g-email" label="Email" error={fields.email}>
                <input type="email" value={form.email} onChange={set('email')} className={FIELD} />
              </Field>
              <Field id="g-phone" label="Phone" error={fields.phone}>
                <input value={form.phone} onChange={set('phone')} className={FIELD} />
              </Field>
              <Field id="g-form-category" label="Delegate category" error={fields.category}>
                <select value={form.category} onChange={set('category')} className={FIELD}>
                  {(Object.keys(DELEGATE_CATEGORY_LABELS) as DelegateCategory[]).map((c) => (
                    <option key={c} value={c}>
                      {DELEGATE_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="g-form-status" label="Registration status" error={fields.status}>
                <select value={form.status} onChange={set('status')} className={FIELD}>
                  {(Object.keys(DELEGATE_STATUS_LABELS) as DelegateStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {DELEGATE_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="g-notes" label="Notes" hint="e.g. dietary or access needs" error={fields.notes}>
                <input value={form.notes} onChange={set('notes')} className={FIELD} />
              </Field>
              <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap gap-3">
                <button type="submit" className={PRIMARY}>
                  {editing ? 'Save delegate' : 'Add delegate'}
                </button>
                {editing && (
                  <button type="button" className={SECONDARY} onClick={cancel}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}
        </>
      )}
    </EditionSection>
  );
}
