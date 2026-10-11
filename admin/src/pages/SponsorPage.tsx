import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Plus } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { can } from '../lib/permissions';
import { getSponsor, saveSponsor, type SponsorInput } from '../lib/sales';
import { useLoad } from '../lib/useLoad';
import { DealsTable } from '../components/DealsTable';
import { FIELD, Field, LINK, Loading, Notice, PageHeader, PRIMARY, SECONDARY, type Message } from '../components/ui';

const FIELDS = [
  ['company', 'Company'],
  ['contact_name', 'Contact name'],
  ['email', 'Email'],
  ['phone', 'Phone'],
] as const;

export default function SponsorPage() {
  const { id = '' } = useParams();
  const { role } = useAuth();
  const canWrite = can(role, 'sponsors.write');
  const { data: sponsor, error, reload } = useLoad(() => getSponsor(id), [id]);
  const [form, setForm] = useState<Required<SponsorInput>>({ company: '', contact_name: '', email: '', phone: '', notes: '' });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<Message>(null);

  useEffect(() => {
    if (sponsor) setForm({ company: sponsor.company, contact_name: sponsor.contact_name, email: sponsor.email, phone: sponsor.phone, notes: sponsor.notes });
  }, [sponsor]);

  if (error) return <p role="alert" className="text-sm text-red-700">{error}</p>;
  if (!sponsor) return <Loading />;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await saveSponsor(id, form);
    setFields(result.ok ? {} : (result.fields ?? {}));
    setMessage(result.ok ? { kind: 'success', text: 'Saved.' } : { kind: 'error', text: result.error });
    if (result.ok) await reload();
  };

  return (
    <section>
      <PageHeader title={sponsor.company} back={{ to: '/sponsors', label: 'All sponsors' }} />
      <Notice message={message} />

      {canWrite ? (
        <form onSubmit={save} noValidate className="mt-6 rounded-lg border border-line bg-white p-5 grid gap-4 sm:grid-cols-2">
          {FIELDS.map(([key, label]) => (
            <Field key={key} id={`s-${key}`} label={label} error={fields[key]}>
              <input type={key === 'email' ? 'email' : 'text'} value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} className={FIELD} />
            </Field>
          ))}
          <Field id="s-notes" label="Notes" className="sm:col-span-2">
            <textarea rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className={FIELD} />
          </Field>
          <div className="sm:col-span-2">
            <button type="submit" className={PRIMARY}>
              Save sponsor
            </button>
          </div>
        </form>
      ) : (
        <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm rounded-lg border border-line bg-white p-5">
          {FIELDS.slice(1)
            .filter(([key]) => sponsor[key])
            .map(([key, label]) => (
              <React.Fragment key={key}>
                <dt className="text-muted">{label}</dt>
                <dd className="text-ink break-words">{key === 'email' ? <a href={`mailto:${sponsor.email}`} className={LINK}>{sponsor.email}</a> : sponsor[key]}</dd>
              </React.Fragment>
            ))}
          {sponsor.notes && (
            <>
              <dt className="text-muted">Notes</dt>
              <dd className="text-ink whitespace-pre-line">{sponsor.notes}</dd>
            </>
          )}
        </dl>
      )}

      <section aria-labelledby="deals-title" className="mt-10">
        <div className="flex items-center justify-between gap-4">
          <h2 id="deals-title" className="text-lg font-semibold text-ink">Deals</h2>
          {can(role, 'deals.write') && (
            <Link to={`/deals/new?sponsor_id=${sponsor.id}`} className={SECONDARY}>
              <Plus className="w-4 h-4" aria-hidden="true" />
              Add deal
            </Link>
          )}
        </div>
        <DealsTable deals={sponsor.deals} showSponsor={false} />
      </section>
    </section>
  );
}
