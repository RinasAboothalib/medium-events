import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Plus } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { deleteSeries, getSeries, listEditions, saveSeries, STATUS_LABELS, type SeriesInput } from '../lib/events';
import { can } from '../lib/permissions';
import { useLoad } from '../lib/useLoad';
import type { Series } from '../lib/types';
import { PartnersPanel } from '../components/PartnersPanel';
import { Confirm, DANGER, FIELD, Field, LINK, Loading, Notice, PageHeader, PRIMARY, SECONDARY, type Message } from '../components/ui';
import { READ_ONLY_EVENTS } from './EventsPage';
import { formatDay } from '../lib/dates';

type Form = Record<'name' | 'slug' | 'label' | 'short_name' | 'tagline' | 'description' | 'website' | 'endorsement' | 'audience' | 'usual_venue' | 'usual_month' | 'cta_secondary' | 'sort_order', string> & { active: boolean };

const EMPTY: Form = {
  name: '', slug: '', label: '', short_name: '', tagline: '', description: '', website: '', endorsement: '',
  audience: '', usual_venue: '', usual_month: '', cta_secondary: '', sort_order: '0', active: true,
};

const toForm = ({ id: _id, edition_count: _count, ...s }: Series): Form => ({
  ...s,
  description: s.description.join('\n\n'),
  website: s.website ?? '',
  endorsement: s.endorsement ?? '',
  cta_secondary: s.cta_secondary ?? '',
  sort_order: String(s.sort_order),
});

const toInput = (f: Form): SeriesInput => ({
  ...f,
  // Paragraphs are separated by a blank line
  description: f.description.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
  website: f.website.trim() || null,
  endorsement: f.endorsement.trim() || null,
  cta_secondary: f.cta_secondary.trim() || null,
  sort_order: Number(f.sort_order) || 0,
});

export default function SeriesPage() {
  const { id = 'new' } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { role } = useAuth();
  const canWrite = can(role, 'events.write');
  const { data: series, error } = useLoad(() => (isNew ? Promise.resolve(null) : getSeries(id)), [id]);
  const { data: editions } = useLoad(() => (isNew ? Promise.resolve([]) : listEditions(id)), [id]);
  const [form, setForm] = useState<Form>(EMPTY);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<Message>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (series) setForm(toForm(series));
  }, [series]);

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const result = await saveSeries(isNew ? null : id, toInput(form));
    setBusy(false);
    if (!result.ok) {
      setFields(result.fields ?? {});
      return setMessage({ kind: 'error', text: result.error });
    }
    setFields({});
    setMessage({ kind: 'success', text: 'Saved.' });
    if (isNew) navigate(`/events/${result.value.id}`, { replace: true });
  };

  const remove = async () => {
    setConfirming(false);
    const result = await deleteSeries(id);
    if (result.ok) navigate('/events', { replace: true });
    else setMessage({ kind: 'error', text: result.error });
  };

  if (error) return <p role="alert" className="text-sm text-red-700">{error}</p>;
  if (!isNew && !series) return <Loading />;

  const input = (key: keyof Form, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input value={form[key] as string} onChange={set(key)} disabled={!canWrite} className={FIELD} {...props} />
  );

  return (
    <section>
      <PageHeader title={isNew ? 'New series' : form.name || series!.name} back={{ to: '/events', label: 'All events' }}>
        {canWrite && !isNew && (
          <button type="button" className={DANGER} onClick={() => setConfirming(true)}>
            Delete series
          </button>
        )}
      </PageHeader>
      {!canWrite && <p className="mt-4 text-sm text-muted">{READ_ONLY_EVENTS}</p>}
      {confirming && (
        <Confirm
          title={`Delete ${series!.name}?`}
          detail="This can't be undone. A series with editions can't be deleted."
          confirmLabel={`Yes, delete ${series!.name}`}
          onConfirm={remove}
          onCancel={() => setConfirming(false)}
        />
      )}
      <Notice message={message} />

      <form onSubmit={submit} noValidate className="mt-6 rounded-lg border border-line bg-white p-5 grid gap-4 sm:grid-cols-2">
        <Field id="s-name" label="Name" error={fields.name}>{input('name')}</Field>
        <Field id="s-slug" label="Web address" hint="medium.mv/events/<this>. Lower-case letters, numbers and dashes." error={fields.slug}>{input('slug')}</Field>
        <Field id="s-label" label="Card label" hint="Short name shown on event cards, e.g. Aviation Forum." error={fields.label}>{input('label')}</Field>
        <Field id="s-short" label="Short name" hint="e.g. CIF" error={fields.short_name}>{input('short_name')}</Field>
        <Field id="s-tagline" label="Tagline" error={fields.tagline} className="sm:col-span-2">{input('tagline')}</Field>
        <Field id="s-description" label="Description" hint="Separate paragraphs with a blank line." error={fields.description} className="sm:col-span-2">
          <textarea rows={5} value={form.description} onChange={set('description')} disabled={!canWrite} className={FIELD} />
        </Field>
        <Field id="s-website" label="Event website" error={fields.website}>{input('website', { type: 'url', placeholder: 'https://' })}</Field>
        <Field id="s-endorsement" label="Endorsement" error={fields.endorsement}>{input('endorsement')}</Field>
        <Field id="s-audience" label="Audience" error={fields.audience}>{input('audience')}</Field>
        <Field id="s-venue" label="Usual venue" error={fields.usual_venue}>{input('usual_venue')}</Field>
        <Field id="s-month" label="Usual month" error={fields.usual_month}>{input('usual_month')}</Field>
        <Field id="s-cta" label="Second button text" hint="Optional, e.g. Book a stand" error={fields.cta_secondary}>{input('cta_secondary')}</Field>
        <Field id="s-order" label="Order on website" error={fields.sort_order}>{input('sort_order', { type: 'number', min: 0 })}</Field>
        <div className="flex items-center gap-2 self-end pb-2">
          <input id="s-active" type="checkbox" checked={form.active} onChange={set('active')} disabled={!canWrite} className="h-4 w-4 accent-brand" />
          <label htmlFor="s-active" className="text-sm font-semibold text-ink">Show on website</label>
        </div>
        {canWrite && (
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy} className={PRIMARY}>
              Save series
            </button>
          </div>
        )}
      </form>

      {!isNew && (
        <>
          <PartnersPanel owner={{ series_id: id }} canWrite={canWrite} />
          <section aria-labelledby="editions-title" className="mt-10">
            <div className="flex items-center justify-between gap-4">
              <h2 id="editions-title" className="text-lg font-semibold text-ink">Editions</h2>
              {canWrite && (
                <Link to={`/events/${id}/editions/new`} className={SECONDARY}>
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  Add edition
                </Link>
              )}
            </div>
            <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-white">
              {(editions ?? []).map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <Link to={`/events/editions/${e.id}`} className={LINK}>
                    {e.name}
                  </Link>
                  <span className="text-body">
                    {formatDay(e.start_date)} · {STATUS_LABELS[e.status]}
                  </span>
                </li>
              ))}
              {editions?.length === 0 && <li className="px-4 py-3 text-sm text-muted">No editions yet.</li>}
            </ul>
          </section>
        </>
      )}
    </section>
  );
}
