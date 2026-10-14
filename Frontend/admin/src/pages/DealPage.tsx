import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useAuth } from '../lib/auth';
import { listEditions } from '../lib/events';
import { can } from '../lib/permissions';
import {
  DEAL_STATUS_LABELS,
  deletePayment,
  formatMoney,
  getDeal,
  listPayments,
  listSponsors,
  METHOD_LABELS,
  outstandingText,
  recordPayment,
  saveDeal,
  type DealInput,
  type PaymentInput,
} from '../lib/sales';
import { formatDay, maldivesToday } from '../lib/dates';
import { useLoad } from '../lib/useLoad';
import type { Deal, DealStatus, Payment, PaymentMethod } from '../lib/types';
import { Confirm, DANGER, FIELD, Field, LINK, Loading, Notice, PageHeader, PRIMARY, SECONDARY, TABLE_WRAP, TD, TH, type Message } from '../components/ui';

type DealForm = Required<DealInput>;

const toForm = (d: Deal): DealForm => ({
  sponsor_id: d.sponsor_id,
  edition_id: d.edition_id,
  package: d.package,
  amount: d.amount === undefined ? '' : String(d.amount),
  currency: d.currency ?? 'MVR',
  status: d.status,
  notes: d.notes ?? '',
});

// /deals/new (optionally ?sponsor_id=) adds a deal; /deals/:id shows one with its payments
export default function DealPage() {
  const { id = 'new' } = useParams();
  const [search] = useSearchParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { role } = useAuth();
  const canWrite = can(role, 'deals.write');
  const { data: deal, error, reload } = useLoad(() => (isNew ? Promise.resolve(null) : getDeal(id)), [id]);
  const { data: sponsors } = useLoad(listSponsors, []);
  const { data: editions } = useLoad(() => listEditions(), []);
  const [form, setForm] = useState<DealForm>({ sponsor_id: search.get('sponsor_id') ?? '', edition_id: '', package: '', amount: '', currency: 'MVR', status: 'proposed', notes: '' });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<Message>(null);

  useEffect(() => {
    if (deal) setForm(toForm(deal));
  }, [deal]);

  if (error) return <p role="alert" className="text-sm text-red-700">{error}</p>;
  if (!isNew && !deal) return <Loading />;

  const set = (key: keyof DealForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    let input: DealInput = form;
    if (deal) {
      // Only what changed, so the activity log shows exactly that
      const before = toForm(deal);
      input = Object.fromEntries(Object.entries(form).filter(([k, v]) => before[k as keyof DealForm] !== v));
    }
    const result = await saveDeal(isNew ? null : id, input);
    setFields(result.ok ? {} : (result.fields ?? {}));
    setMessage(result.ok ? { kind: 'success', text: 'Saved.' } : { kind: 'error', text: result.error });
    if (!result.ok) return;
    if (isNew) navigate(`/deals/${result.value.id}`, { replace: true });
    else await reload();
  };

  const title = deal ? `${deal.sponsor_company} · ${deal.package}` : 'New deal';
  const showMoney = deal ? deal.amount !== undefined : true;

  return (
    <section className="max-w-4xl">
      <PageHeader title={title} intro={deal?.edition_name} back={{ to: '/deals', label: 'All deals' }} />
      <Notice message={message} />

      {canWrite ? (
        <form onSubmit={save} noValidate className="mt-6 rounded-lg border border-line bg-white p-5 grid gap-4 sm:grid-cols-2">
          <Field id="d-sponsor" label="Sponsor" error={fields.sponsor_id}>
            <select value={form.sponsor_id} onChange={set('sponsor_id')} className={FIELD}>
              <option value="">Choose a sponsor</option>
              {(sponsors ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.company}
                </option>
              ))}
            </select>
          </Field>
          <Field id="d-edition" label="Event" error={fields.edition_id}>
            <select value={form.edition_id} onChange={set('edition_id')} className={FIELD}>
              <option value="">Choose an event</option>
              {(editions ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="d-package" label="Package" hint="e.g. Platinum sponsor, 3×3 m stand" error={fields.package}>
            <input value={form.package} onChange={set('package')} className={FIELD} />
          </Field>
          <Field id="d-status" label="Status" error={fields.status}>
            <select value={form.status} onChange={set('status')} className={FIELD}>
              {(Object.keys(DEAL_STATUS_LABELS) as DealStatus[]).map((s) => (
                <option key={s} value={s}>
                  {DEAL_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="d-amount" label="Amount" hint="e.g. 150000 or 1,500.50" error={fields.amount}>
            <input inputMode="decimal" value={form.amount} onChange={set('amount')} className={FIELD} />
          </Field>
          <Field id="d-currency" label="Currency" error={fields.currency}>
            <select value={form.currency} onChange={set('currency')} className={FIELD}>
              <option value="MVR">MVR</option>
              <option value="USD">USD</option>
            </select>
          </Field>
          <Field id="d-notes" label="Notes" error={fields.notes} className="sm:col-span-2">
            <textarea rows={3} value={form.notes} onChange={set('notes')} className={FIELD} />
          </Field>
          <div className="sm:col-span-2">
            <button type="submit" className={PRIMARY}>
              Save deal
            </button>
          </div>
        </form>
      ) : (
        deal && (
          <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm rounded-lg border border-line bg-white p-5">
            <dt className="text-muted">Sponsor</dt>
            <dd>
              <Link to={`/sponsors/${deal.sponsor_id}`} className={LINK}>{deal.sponsor_company}</Link>
            </dd>
            <dt className="text-muted">Event</dt>
            <dd className="text-ink">{deal.edition_name}</dd>
            <dt className="text-muted">Status</dt>
            <dd className="text-ink">{DEAL_STATUS_LABELS[deal.status]}</dd>
            {showMoney && (
              <>
                <dt className="text-muted">Amount</dt>
                <dd className="text-ink">{formatMoney(deal.amount!, deal.currency!)}</dd>
              </>
            )}
            {deal.notes && (
              <>
                <dt className="text-muted">Notes</dt>
                <dd className="text-ink whitespace-pre-line">{deal.notes}</dd>
              </>
            )}
          </dl>
        )
      )}

      {deal && can(role, 'payments.read') && <Payments deal={deal} onChange={reload} />}
    </section>
  );
}

function Payments({ deal, onChange }: { deal: Deal; onChange: () => Promise<void> }) {
  const { role } = useAuth();
  const { data: payments, reload } = useLoad(() => listPayments(deal.id), [deal.id]);
  const empty: PaymentInput = { amount: '', paid_on: maldivesToday(), method: 'bank_transfer', invoice_no: '', notes: '' };
  const [form, setForm] = useState<PaymentInput>(empty);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<Message>(null);
  const [deleting, setDeleting] = useState<Payment | null>(null);
  const currency = deal.currency!;

  const refresh = async () => {
    await reload();
    await onChange();
  };

  const record = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await recordPayment(deal.id, form);
    setFields(result.ok ? {} : (result.fields ?? {}));
    setMessage(result.ok ? { kind: 'success', text: 'Payment recorded.' } : { kind: 'error', text: result.error });
    if (!result.ok) return;
    setForm(empty);
    await refresh();
  };

  const remove = async () => {
    const payment = deleting!;
    setDeleting(null);
    const result = await deletePayment(payment.id);
    setMessage(result.ok ? { kind: 'success', text: 'Payment deleted.' } : { kind: 'error', text: result.error });
    if (result.ok) await refresh();
  };

  const set = (key: keyof PaymentInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const label = (p: Payment) => p.invoice_no || formatDay(p.paid_on);

  return (
    <section aria-labelledby="payments-title" className="mt-10">
      <h2 id="payments-title" className="text-lg font-semibold text-ink">Payments</h2>
      <p className="mt-1 text-sm text-body">
        Received {formatMoney(deal.paid!, currency)} of {formatMoney(deal.amount!, currency)}.
      </p>
      <p className="mt-1 text-base font-semibold text-ink">Outstanding: {outstandingText(deal.outstanding!, currency)}</p>
      <Notice message={message} />
      {deleting && (
        <Confirm
          title={`Delete the payment of ${formatMoney(deleting.amount, currency)}?`}
          detail="This can't be undone. It is recorded in the activity log."
          confirmLabel="Yes, delete this payment"
          onConfirm={remove}
          onCancel={() => setDeleting(null)}
        />
      )}

      <div className={TABLE_WRAP}>
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-surface text-left text-xs font-semibold uppercase tracking-wider text-muted">
            <tr>
              <th scope="col" className={TH}>Date</th>
              <th scope="col" className={`${TH} text-right`}>Amount</th>
              <th scope="col" className={TH}>Method</th>
              <th scope="col" className={TH}>Invoice</th>
              <th scope="col" className={TH}>Recorded by</th>
              {can(role, 'payments.delete') && <th scope="col" className={TH}><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(payments ?? []).map((p) => (
              <tr key={p.id}>
                <td className={`${TD} whitespace-nowrap`}>{formatDay(p.paid_on)}</td>
                <td className={`${TD} text-right whitespace-nowrap`}>{formatMoney(p.amount, currency)}</td>
                <td className={`${TD} text-body`}>{METHOD_LABELS[p.method]}</td>
                <td className={`${TD} text-body`}>{p.invoice_no}</td>
                <td className={`${TD} text-body`}>{p.recorded_by_name ?? 'Former staff'}</td>
                {can(role, 'payments.delete') && (
                  <td className={`${TD} text-right`}>
                    <button type="button" className={DANGER} aria-label={`Delete payment ${label(p)}`} onClick={() => setDeleting(p)}>
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {payments?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  No payments yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {can(role, 'payments.write') && deal.status !== 'cancelled' && (
        <form onSubmit={record} noValidate aria-label="Record payment" className="mt-4 rounded-lg border border-line bg-white p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field id="p-amount" label="Amount received" hint={`In ${currency}`} error={fields.amount}>
            <input inputMode="decimal" value={form.amount} onChange={set('amount')} className={FIELD} />
          </Field>
          <Field id="p-date" label="Date received" error={fields.paid_on}>
            <input type="date" value={form.paid_on} onChange={set('paid_on')} className={FIELD} />
          </Field>
          <Field id="p-method" label="Method" error={fields.method}>
            <select value={form.method} onChange={set('method')} className={FIELD}>
              {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABELS[m]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="p-invoice" label="Invoice number" error={fields.invoice_no}>
            <input value={form.invoice_no} onChange={set('invoice_no')} className={FIELD} />
          </Field>
          <Field id="p-notes" label="Notes" error={fields.notes} className="lg:col-span-2">
            <input value={form.notes} onChange={set('notes')} className={FIELD} />
          </Field>
          <div className="sm:col-span-2 lg:col-span-3">
            <button type="submit" className={SECONDARY}>
              Record payment
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
