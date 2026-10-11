import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useAuth } from '../lib/auth';
import { checkImage, deleteEdition, fileUrl, getEdition, getSeries, saveEdition, STATUS_LABELS, uploadBanner, type EditionInput } from '../lib/events';
import { can } from '../lib/permissions';
import { useLoad } from '../lib/useLoad';
import type { Edition, EditionStatus } from '../lib/types';
import { EditionTabs } from '../components/EditionTabs';
import { PartnersPanel } from '../components/PartnersPanel';
import { Confirm, DANGER, FIELD, Field, Loading, Notice, PageHeader, PRIMARY, type Message } from '../components/ui';
import { READ_ONLY_EVENTS } from './EventsPage';

type Form = Record<'name' | 'start_date' | 'end_date' | 'venue' | 'description' | 'rsvp_count' | 'attendance' | 'facebook_url' | 'outcome_notes', string> & {
  status: EditionStatus;
  banner_file_id: string | null;
};

const EMPTY: Form = {
  name: '', start_date: '', end_date: '', venue: '', description: '', rsvp_count: '', attendance: '', facebook_url: '', outcome_notes: '',
  status: 'upcoming', banner_file_id: null,
};

const toForm = (e: Edition): Form => ({
  name: e.name,
  start_date: e.start_date,
  end_date: e.end_date ?? '',
  venue: e.venue,
  description: e.description,
  rsvp_count: e.rsvp_count === null ? '' : String(e.rsvp_count),
  attendance: e.attendance === null ? '' : String(e.attendance),
  facebook_url: e.facebook_url ?? '',
  outcome_notes: e.outcome_notes,
  status: e.status,
  banner_file_id: e.banner_file_id,
});

const count = (value: string) => (value.trim() === '' ? null : Number(value));

const toInput = (f: Form): Partial<EditionInput> => ({
  ...f,
  end_date: f.end_date || null,
  rsvp_count: count(f.rsvp_count),
  attendance: count(f.attendance),
  facebook_url: f.facebook_url.trim() || null,
});

// /events/editions/:id edits an edition; /events/:seriesId/editions/new adds one to a series
export default function EditionPage() {
  const { id, seriesId } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { role } = useAuth();
  const canWrite = can(role, 'events.write');
  const { data: edition, error } = useLoad(() => (id ? getEdition(id) : Promise.resolve(null)), [id]);
  const { data: series } = useLoad(() => (seriesId ? getSeries(seriesId) : Promise.resolve(null)), [seriesId]);
  const [form, setForm] = useState<Form>(EMPTY);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<Message>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (edition) setForm(toForm(edition));
  }, [edition]);

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  const backTo = `/events/${edition?.series_id ?? seriesId}`;

  const pickBanner = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const problem = checkImage(file);
    if (problem) return setBannerError(problem);
    setBannerError(null);
    const result = await uploadBanner(file);
    if (!result.ok) return setBannerError(result.error);
    setForm((f) => ({ ...f, banner_file_id: result.value.id }));
    setMessage({ kind: 'success', text: 'Banner uploaded. Save the edition to keep it.' });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const input = toInput(form);
    const result = await saveEdition(id ?? null, isNew ? { ...input, series_id: seriesId } : input);
    setBusy(false);
    if (!result.ok) {
      setFields(result.fields ?? {});
      return setMessage({ kind: 'error', text: result.error });
    }
    setFields({});
    setMessage({ kind: 'success', text: 'Saved.' });
    if (isNew) navigate(`/events/editions/${result.value.id}`, { replace: true });
  };

  const remove = async () => {
    setConfirming(false);
    const result = await deleteEdition(id!);
    if (result.ok) navigate(backTo, { replace: true });
    else setMessage({ kind: 'error', text: result.error });
  };

  if (error) return <p role="alert" className="text-sm text-red-700">{error}</p>;
  if (!isNew && !edition) return <Loading />;

  const input = (key: keyof Form, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input value={form[key] as string} onChange={set(key)} disabled={!canWrite} className={FIELD} {...props} />
  );
  const seriesName = edition?.series_name ?? series?.name ?? 'series';

  return (
    <section>
      <PageHeader title={isNew ? 'New edition' : form.name || edition!.name} intro={seriesName} back={{ to: backTo, label: `Back to ${seriesName}` }}>
        {canWrite && !isNew && (
          <button type="button" className={DANGER} onClick={() => setConfirming(true)}>
            Delete edition
          </button>
        )}
      </PageHeader>
      {!isNew && <EditionTabs editionId={id!} />}
      {!canWrite && <p className="mt-4 text-sm text-muted">{READ_ONLY_EVENTS}</p>}
      {confirming && (
        <Confirm title={`Delete ${edition!.name}?`} detail="This can't be undone. Its tasks and programme are deleted with it; an edition with deals, delegates or expenses can't be deleted." confirmLabel={`Yes, delete ${edition!.name}`} onConfirm={remove} onCancel={() => setConfirming(false)} />
      )}
      <Notice message={message} />

      <form onSubmit={submit} noValidate className="mt-6 rounded-lg border border-line bg-white p-5 grid gap-4 sm:grid-cols-2">
        <Field id="e-name" label="Name" error={fields.name} className="sm:col-span-2">{input('name')}</Field>
        <Field id="e-start" label="Start date" error={fields.start_date}>{input('start_date', { type: 'date' })}</Field>
        <Field id="e-end" label="End date" hint="Leave empty for a one-day event." error={fields.end_date}>{input('end_date', { type: 'date' })}</Field>
        <Field id="e-venue" label="Venue" error={fields.venue}>{input('venue')}</Field>
        <Field id="e-status" label="Status" hint="Past editions appear on the website's event list." error={fields.status}>
          <select value={form.status} onChange={set('status')} disabled={!canWrite} className={FIELD}>
            {(Object.keys(STATUS_LABELS) as EditionStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field id="e-description" label="Description" error={fields.description} className="sm:col-span-2">
          <textarea rows={4} value={form.description} onChange={set('description')} disabled={!canWrite} className={FIELD} />
        </Field>
        <Field id="e-rsvp" label="RSVPs" hint="People who responded on Facebook." error={fields.rsvp_count}>{input('rsvp_count', { type: 'number', min: 0 })}</Field>
        <Field id="e-attendance" label="Attendance" hint="People who attended." error={fields.attendance}>{input('attendance', { type: 'number', min: 0 })}</Field>
        <Field id="e-facebook" label="Facebook event link" error={fields.facebook_url} className="sm:col-span-2">{input('facebook_url', { type: 'url', placeholder: 'https://www.facebook.com/events/…' })}</Field>
        <Field id="e-outcome" label="Outcome notes" hint="For the post-event report: highlights, results, follow-ups." error={fields.outcome_notes} className="sm:col-span-2">
          <textarea rows={4} value={form.outcome_notes} onChange={set('outcome_notes')} disabled={!canWrite} className={FIELD} />
        </Field>

        <div className="sm:col-span-2">
          <p className="text-sm font-semibold text-ink mb-1.5">Banner</p>
          {form.banner_file_id ? (
            <img src={fileUrl(form.banner_file_id)} alt={`Banner for ${form.name}`} className="w-full max-w-md rounded-md border border-line" />
          ) : (
            <p className="text-sm text-muted">No banner yet.</p>
          )}
          {canWrite && (
            <div className="mt-3">
              <label htmlFor="e-banner" className="block text-sm font-semibold text-ink mb-1.5">Banner image</label>
              <input id="e-banner" type="file" accept="image/jpeg,image/png,image/webp" onChange={pickBanner} className="block text-sm text-body" />
              <p className="mt-1 text-xs text-muted">JPG, PNG or WebP, up to 5 MB.</p>
              {bannerError && (
                <p role="alert" className="mt-1 text-sm text-red-700">
                  {bannerError}
                </p>
              )}
            </div>
          )}
        </div>

        {canWrite && (
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy} className={PRIMARY}>
              Save edition
            </button>
          </div>
        )}
      </form>

      {!isNew && <PartnersPanel owner={{ edition_id: id! }} canWrite={canWrite} />}
    </section>
  );
}
