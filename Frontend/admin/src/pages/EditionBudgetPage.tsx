import React, { useState } from 'react';
import { useParams } from 'react-router';
import { Download } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { formatDay } from '../lib/dates';
import { budgetSummary, deleteExpense, EXPENSE_CATEGORY_LABELS, EXPENSE_STATUS_LABELS, listExpenses, saveExpense } from '../lib/operations';
import { can } from '../lib/permissions';
import { formatMoney } from '../lib/sales';
import { useLoad } from '../lib/useLoad';
import type { Currency, Expense, ExpenseCategory, ExpenseStatus } from '../lib/types';
import { EditionSection } from '../components/EditionTabs';
import { Confirm, FIELD, Field, Loading, Notice, PRIMARY, SECONDARY, TABLE_WRAP, TD, TH, type Message } from '../components/ui';

const STATUS_STYLES: Record<ExpenseStatus, string> = {
  planned: 'bg-surface text-muted',
  committed: 'bg-amber-50 text-amber-800',
  paid: 'bg-green-50 text-green-800',
};

type Form = Record<'description' | 'vendor' | 'amount' | 'paid_on' | 'invoice_no' | 'notes', string> & { category: ExpenseCategory; currency: Currency; status: ExpenseStatus };
const EMPTY: Form = { description: '', vendor: '', amount: '', paid_on: '', invoice_no: '', notes: '', category: 'venue', currency: 'MVR', status: 'planned' };

// "MVR 1,000.00" or "−MVR 1,000.00" for a loss
const signed = (amount: number, currency: string) => (amount < 0 ? `−${formatMoney(-amount, currency)}` : formatMoney(amount, currency));

// /events/editions/:id/budget — what an edition costs, set against its sponsorship income
export default function EditionBudgetPage() {
  const { id = '' } = useParams();
  const { role } = useAuth();
  const canWrite = can(role, 'expenses.write');
  const expenses = useLoad(() => listExpenses(id), [id]);
  const summary = useLoad(() => budgetSummary(id), [id]);
  const [form, setForm] = useState<Form>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<Message>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);

  const reload = async () => {
    await Promise.all([expenses.reload(), summary.reload()]);
  };
  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const edit = (x: Expense) => {
    setEditing(x.id);
    setFields({});
    setMessage(null);
    setForm({ description: x.description, vendor: x.vendor, amount: String(x.amount), paid_on: x.paid_on ?? '', invoice_no: x.invoice_no, notes: x.notes, category: x.category, currency: x.currency, status: x.status });
  };
  const cancel = () => {
    setEditing(null);
    setFields({});
    setForm(EMPTY);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = { ...form, paid_on: form.paid_on || null };
    const result = await saveExpense(editing, editing ? input : { ...input, edition_id: id });
    setFields(result.ok ? {} : (result.fields ?? {}));
    setMessage(result.ok ? { kind: 'success', text: editing ? 'Expense saved.' : 'Expense added.' } : { kind: 'error', text: result.error });
    if (!result.ok) return;
    cancel();
    await reload();
  };

  const remove = async () => {
    const x = deleting!;
    setDeleting(null);
    if (editing === x.id) cancel();
    const result = await deleteExpense(x.id);
    setMessage(result.ok ? { kind: 'success', text: 'Expense removed.' } : { kind: 'error', text: result.error });
    await reload();
  };

  const error = expenses.error ?? summary.error;

  return (
    <EditionSection
      editionId={id}
      intro="Budget: what the event costs, set against its sponsorship income."
      actions={
        can(role, 'reports.budget') && (
          <a href={`/api/reports/budget.xlsx?edition_id=${id}`} download className={SECONDARY}>
            <Download className="w-4 h-4" aria-hidden="true" />
            Download Excel
          </a>
        )
      }
    >
      {() => (
        <>
          {error && <p role="alert" className="mt-6 text-sm text-red-700">{error}</p>}

          <section aria-labelledby="budget-summary" className="mt-6">
            <h2 id="budget-summary" className="text-lg font-semibold text-ink">Income and expenses</h2>
            <p className="mt-1 text-sm text-body">Per currency. The projected result is confirmed sponsorship less every expense; the cash result is money received less expenses paid.</p>
            {!summary.data ? (
              <Loading />
            ) : summary.data.length === 0 ? (
              <p className="mt-3 rounded-lg border border-line bg-white px-4 py-3 text-sm text-muted">No sponsorship deals or expenses yet.</p>
            ) : (
              <div className={`${TABLE_WRAP} mt-3`}>
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-surface text-left text-xs font-semibold uppercase tracking-wider text-muted">
                    <tr>
                      <th scope="col" className={TH}>Currency</th>
                      <th scope="col" className={`${TH} text-right`}>Sponsorship confirmed</th>
                      <th scope="col" className={`${TH} text-right`}>Received</th>
                      <th scope="col" className={`${TH} text-right`}>Expenses</th>
                      <th scope="col" className={`${TH} text-right`}>Paid out</th>
                      <th scope="col" className={`${TH} text-right`}>Projected result</th>
                      <th scope="col" className={`${TH} text-right`}>Cash result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {summary.data.map((line) => (
                      <tr key={line.currency}>
                        <th scope="row" className={`${TD} text-left font-semibold text-ink`}>{line.currency}</th>
                        <td className={`${TD} text-right whitespace-nowrap`}>{formatMoney(line.income_confirmed, line.currency)}</td>
                        <td className={`${TD} text-right whitespace-nowrap`}>{formatMoney(line.income_received, line.currency)}</td>
                        <td className={`${TD} text-right whitespace-nowrap`}>{formatMoney(line.expenses_total, line.currency)}</td>
                        <td className={`${TD} text-right whitespace-nowrap`}>{formatMoney(line.expenses_paid, line.currency)}</td>
                        <td className={`${TD} text-right whitespace-nowrap font-semibold ${line.projected_result < 0 ? 'text-red-700' : 'text-ink'}`}>{signed(line.projected_result, line.currency)}</td>
                        <td className={`${TD} text-right whitespace-nowrap font-semibold ${line.cash_result < 0 ? 'text-red-700' : 'text-ink'}`}>{signed(line.cash_result, line.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section aria-labelledby="expenses-title" className="mt-10">
            <h2 id="expenses-title" className="text-lg font-semibold text-ink">Expenses</h2>
            <Notice message={message} />
            {deleting && (
              <Confirm
                title={`Remove "${deleting.description}" (${formatMoney(deleting.amount, deleting.currency)})?`}
                detail="This can't be undone. It is recorded in the activity log."
                confirmLabel="Yes, remove this expense"
                onConfirm={remove}
                onCancel={() => setDeleting(null)}
              />
            )}
            {!expenses.data ? (
              <Loading />
            ) : (
              <div className={`${TABLE_WRAP} mt-3`}>
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-surface text-left text-xs font-semibold uppercase tracking-wider text-muted">
                    <tr>
                      <th scope="col" className={TH}>Expense</th>
                      <th scope="col" className={TH}>Category</th>
                      <th scope="col" className={TH}>Vendor</th>
                      <th scope="col" className={`${TH} text-right`}>Amount</th>
                      <th scope="col" className={TH}>Status</th>
                      {canWrite && <th scope="col" className={TH}><span className="sr-only">Actions</span></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {expenses.data.map((x) => (
                      <tr key={x.id}>
                        <td className={TD}>
                          <span className="font-medium text-ink">{x.description}</span>
                          {x.invoice_no && <span className="block text-xs text-muted">Invoice {x.invoice_no}</span>}
                        </td>
                        <td className={`${TD} text-body`}>{EXPENSE_CATEGORY_LABELS[x.category]}</td>
                        <td className={`${TD} text-body`}>{x.vendor}</td>
                        <td className={`${TD} text-right whitespace-nowrap`}>{formatMoney(x.amount, x.currency)}</td>
                        <td className={TD}>
                          <span className={`rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${STATUS_STYLES[x.status]}`}>{EXPENSE_STATUS_LABELS[x.status]}</span>
                          {x.status === 'paid' && x.paid_on && <span className="block mt-1 text-xs text-muted whitespace-nowrap">{formatDay(x.paid_on)}</span>}
                        </td>
                        {canWrite && (
                          <td className={`${TD} text-right whitespace-nowrap`}>
                            <span className="inline-flex gap-2">
                              <button type="button" className={SECONDARY} aria-label={`Edit ${x.description}`} onClick={() => edit(x)}>
                                Edit
                              </button>
                              <button type="button" className={SECONDARY} aria-label={`Remove ${x.description}`} onClick={() => setDeleting(x)}>
                                Remove
                              </button>
                            </span>
                          </td>
                        )}
                      </tr>
                    ))}
                    {expenses.data.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-muted">
                          No expenses yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {canWrite && (
              <form onSubmit={submit} noValidate aria-label={editing ? 'Edit expense' : 'Add expense'} className="mt-4 rounded-lg border border-line bg-white p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field id="x-description" label="What it is for" error={fields.description} className="sm:col-span-2">
                  <input value={form.description} onChange={set('description')} placeholder="e.g. Hall hire, two days" className={FIELD} />
                </Field>
                <Field id="x-category" label="Category" error={fields.category}>
                  <select value={form.category} onChange={set('category')} className={FIELD}>
                    {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map((c) => (
                      <option key={c} value={c}>
                        {EXPENSE_CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field id="x-vendor" label="Vendor" error={fields.vendor}>
                  <input value={form.vendor} onChange={set('vendor')} className={FIELD} />
                </Field>
                <Field id="x-amount" label="Amount" hint="e.g. 45000 or 1,500.50" error={fields.amount}>
                  <input inputMode="decimal" value={form.amount} onChange={set('amount')} className={FIELD} />
                </Field>
                <Field id="x-currency" label="Currency" error={fields.currency}>
                  <select value={form.currency} onChange={set('currency')} className={FIELD}>
                    <option value="MVR">MVR</option>
                    <option value="USD">USD</option>
                  </select>
                </Field>
                <Field id="x-status" label="Expense status" hint="Committed = agreed with the vendor." error={fields.status}>
                  <select value={form.status} onChange={set('status')} className={FIELD}>
                    {(Object.keys(EXPENSE_STATUS_LABELS) as ExpenseStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {EXPENSE_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field id="x-paid" label="Date paid" hint="Needed once it is paid." error={fields.paid_on}>
                  <input type="date" value={form.paid_on} onChange={set('paid_on')} className={FIELD} />
                </Field>
                <Field id="x-invoice" label="Invoice number" error={fields.invoice_no}>
                  <input value={form.invoice_no} onChange={set('invoice_no')} className={FIELD} />
                </Field>
                <Field id="x-notes" label="Notes" error={fields.notes} className="lg:col-span-3">
                  <input value={form.notes} onChange={set('notes')} className={FIELD} />
                </Field>
                <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap gap-3">
                  <button type="submit" className={PRIMARY}>
                    {editing ? 'Save expense' : 'Add expense'}
                  </button>
                  {editing && (
                    <button type="button" className={SECONDARY} onClick={cancel}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            )}
          </section>
        </>
      )}
    </EditionSection>
  );
}
