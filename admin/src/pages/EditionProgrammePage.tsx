import React, { useState } from 'react';
import { useParams } from 'react-router';
import { useAuth } from '../lib/auth';
import { formatDay } from '../lib/dates';
import { deleteSession, deleteSpeaker, listSessions, listSpeakers, saveSession, saveSpeaker, SESSION_KIND_LABELS } from '../lib/operations';
import { can } from '../lib/permissions';
import { useLoad } from '../lib/useLoad';
import type { Edition, ProgrammeSession, SessionKind, Speaker } from '../lib/types';
import { EditionSection } from '../components/EditionTabs';
import { FIELD, Field, Notice, PRIMARY, SECONDARY, type Message } from '../components/ui';
import { READ_ONLY_EVENTS } from './EventsPage';

type SessionForm = { title: string; day: string; start_time: string; end_time: string; room: string; kind: SessionKind; description: string; speaker_ids: string[] };
type SpeakerForm = { full_name: string; job_title: string; organisation: string };
const NO_SPEAKER: SpeakerForm = { full_name: '', job_title: '', organisation: '' };

// /events/editions/:id/programme — the speakers of an edition and its sessions in running order
export default function EditionProgrammePage() {
  const { id = '' } = useParams();
  return (
    <EditionSection editionId={id} intro="Programme: speakers and the sessions they take part in.">
      {(edition) => <Programme edition={edition} />}
    </EditionSection>
  );
}

function Programme({ edition }: { edition: Edition }) {
  const { role } = useAuth();
  const canWrite = can(role, 'events.write');
  const speakers = useLoad(() => listSpeakers(edition.id), [edition.id]);
  const sessions = useLoad(() => listSessions(edition.id), [edition.id]);
  const reload = async () => {
    await Promise.all([speakers.reload(), sessions.reload()]);
  };

  return (
    <>
      {!canWrite && <p className="mt-4 text-sm text-muted">{READ_ONLY_EVENTS}</p>}
      {(speakers.error || sessions.error) && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {speakers.error ?? sessions.error}
        </p>
      )}
      <Sessions edition={edition} sessions={sessions.data ?? []} speakers={speakers.data ?? []} canWrite={canWrite} reload={reload} />
      <Speakers edition={edition} speakers={speakers.data ?? []} canWrite={canWrite} reload={reload} />
    </>
  );
}

function Sessions({ edition, sessions, speakers, canWrite, reload }: { edition: Edition; sessions: ProgrammeSession[]; speakers: Speaker[]; canWrite: boolean; reload: () => Promise<void> }) {
  const empty: SessionForm = { title: '', day: edition.start_date, start_time: '09:00', end_time: '', room: '', kind: 'presentation', description: '', speaker_ids: [] };
  const [form, setForm] = useState<SessionForm>(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<Message>(null);
  const multiDay = !!edition.end_date && edition.end_date !== edition.start_date;
  const days = [...new Set(sessions.map((s) => s.day))];

  const set = (key: keyof SessionForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const toggleSpeaker = (speakerId: string) =>
    setForm((f) => ({ ...f, speaker_ids: f.speaker_ids.includes(speakerId) ? f.speaker_ids.filter((x) => x !== speakerId) : [...f.speaker_ids, speakerId] }));

  const edit = (s: ProgrammeSession) => {
    setEditing(s.id);
    setFields({});
    setMessage(null);
    setForm({ title: s.title, day: s.day, start_time: s.start_time, end_time: s.end_time ?? '', room: s.room, kind: s.kind, description: s.description, speaker_ids: s.speakers.map((x) => x.id) });
  };
  const cancel = () => {
    setEditing(null);
    setFields({});
    setForm(empty);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = { ...form, end_time: form.end_time || null };
    const result = await saveSession(editing, editing ? input : { ...input, edition_id: edition.id });
    setFields(result.ok ? {} : (result.fields ?? {}));
    setMessage(result.ok ? { kind: 'success', text: editing ? 'Session saved.' : 'Session added.' } : { kind: 'error', text: result.error });
    if (!result.ok) return;
    setEditing(null);
    // Keep the day so the next session of that day is quick to add
    setForm({ ...empty, day: form.day });
    await reload();
  };

  const remove = async (s: ProgrammeSession) => {
    const result = await deleteSession(s.id);
    setMessage(result.ok ? null : { kind: 'error', text: result.error });
    if (editing === s.id) cancel();
    await reload();
  };

  return (
    <section aria-labelledby="sessions-title" className="mt-8">
      <h2 id="sessions-title" className="text-lg font-semibold text-ink">Sessions</h2>
      <Notice message={message} />
      {sessions.length === 0 && <p className="mt-3 rounded-lg border border-line bg-white px-4 py-3 text-sm text-muted">No sessions yet.</p>}
      {days.map((day) => (
        <div key={day} className="mt-4">
          {(multiDay || days.length > 1) && <h3 className="text-sm font-semibold text-ink">{formatDay(day)}</h3>}
          <ul className="mt-2 divide-y divide-line rounded-lg border border-line bg-white">
            {sessions.filter((s) => s.day === day).map((s) => (
              <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p>
                    <span className="font-semibold text-ink whitespace-nowrap">
                      {s.start_time}
                      {s.end_time && `–${s.end_time}`}
                    </span>
                    <span className="ml-3 font-medium text-ink">{s.title}</span>
                    <span className="ml-2 rounded-md bg-surface px-2 py-0.5 text-xs font-semibold text-muted">{SESSION_KIND_LABELS[s.kind]}</span>
                  </p>
                  {(s.room || s.speakers.length > 0) && (
                    <p className="mt-1 text-body">{[s.room, s.speakers.map((x) => x.full_name).join(', ')].filter(Boolean).join(' · ')}</p>
                  )}
                  {s.description && <p className="mt-1 text-body whitespace-pre-line">{s.description}</p>}
                </div>
                {canWrite && (
                  <div className="flex gap-2 shrink-0">
                    <button type="button" className={SECONDARY} aria-label={`Edit ${s.title}`} onClick={() => edit(s)}>
                      Edit
                    </button>
                    <button type="button" className={SECONDARY} aria-label={`Remove ${s.title}`} onClick={() => remove(s)}>
                      Remove
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {canWrite && (
        <form onSubmit={submit} noValidate aria-label={editing ? 'Edit session' : 'Add session'} className="mt-4 rounded-lg border border-line bg-white p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field id="s-title" label="Session title" error={fields.title} className="sm:col-span-2">
            <input value={form.title} onChange={set('title')} className={FIELD} />
          </Field>
          <Field id="s-kind" label="Type" error={fields.kind}>
            <select value={form.kind} onChange={set('kind')} className={FIELD}>
              {(Object.keys(SESSION_KIND_LABELS) as SessionKind[]).map((k) => (
                <option key={k} value={k}>
                  {SESSION_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="s-room" label="Room" error={fields.room}>
            <input value={form.room} onChange={set('room')} className={FIELD} />
          </Field>
          <Field id="s-day" label="Day" error={fields.day}>
            <input type="date" min={edition.start_date} max={edition.end_date ?? edition.start_date} value={form.day} onChange={set('day')} className={FIELD} />
          </Field>
          <Field id="s-start" label="Starts" error={fields.start_time}>
            <input type="time" value={form.start_time} onChange={set('start_time')} className={FIELD} />
          </Field>
          <Field id="s-end" label="Ends" hint="Optional." error={fields.end_time}>
            <input type="time" value={form.end_time} onChange={set('end_time')} className={FIELD} />
          </Field>
          <Field id="s-description" label="Description" error={fields.description} className="sm:col-span-2 lg:col-span-4">
            <textarea rows={2} value={form.description} onChange={set('description')} className={FIELD} />
          </Field>
          {speakers.length > 0 && (
            <fieldset className="sm:col-span-2 lg:col-span-4">
              <legend className="text-sm font-semibold text-ink mb-1.5">Speakers in this session</legend>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {speakers.map((sp) => (
                  <label key={sp.id} className="inline-flex items-center gap-2 text-sm text-ink">
                    <input type="checkbox" checked={form.speaker_ids.includes(sp.id)} onChange={() => toggleSpeaker(sp.id)} />
                    {sp.full_name}
                  </label>
                ))}
              </div>
              {fields.speaker_ids && <p className="mt-1 text-xs text-red-700">{fields.speaker_ids}</p>}
            </fieldset>
          )}
          <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap gap-3">
            <button type="submit" className={PRIMARY}>
              {editing ? 'Save session' : 'Add session'}
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
  );
}

function Speakers({ edition, speakers, canWrite, reload }: { edition: Edition; speakers: Speaker[]; canWrite: boolean; reload: () => Promise<void> }) {
  const [form, setForm] = useState<SpeakerForm>(NO_SPEAKER);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<Message>(null);
  const set = (key: keyof SpeakerForm) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await saveSpeaker(null, { ...form, edition_id: edition.id, sort_order: speakers.length });
    setFields(result.ok ? {} : (result.fields ?? {}));
    setMessage(result.ok ? null : { kind: 'error', text: result.error });
    if (!result.ok) return;
    setForm(NO_SPEAKER);
    await reload();
  };

  const remove = async (sp: Speaker) => {
    const result = await deleteSpeaker(sp.id);
    setMessage(result.ok ? null : { kind: 'error', text: result.error });
    await reload();
  };

  return (
    <section aria-labelledby="speakers-title" className="mt-10">
      <h2 id="speakers-title" className="text-lg font-semibold text-ink">Speakers</h2>
      <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-white">
        {speakers.map((sp) => (
          <li key={sp.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <span className="min-w-0">
              <span className="font-medium text-ink">{sp.full_name}</span>
              {(sp.job_title || sp.organisation) && <span className="text-body"> · {[sp.job_title, sp.organisation].filter(Boolean).join(', ')}</span>}
              <span className="text-muted"> · {sp.session_count === 1 ? '1 session' : `${sp.session_count} sessions`}</span>
            </span>
            {canWrite && (
              <button type="button" className={SECONDARY} aria-label={`Remove ${sp.full_name}`} onClick={() => remove(sp)}>
                Remove
              </button>
            )}
          </li>
        ))}
        {speakers.length === 0 && <li className="px-4 py-3 text-sm text-muted">No speakers yet.</li>}
      </ul>
      {canWrite && (
        <form onSubmit={add} noValidate aria-label="Add speaker" className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] items-start">
          <Field id="sp-name" label="Speaker name" error={fields.full_name}>
            <input value={form.full_name} onChange={set('full_name')} className={FIELD} />
          </Field>
          <Field id="sp-title" label="Job title" error={fields.job_title}>
            <input value={form.job_title} onChange={set('job_title')} className={FIELD} />
          </Field>
          <Field id="sp-org" label="Organisation" error={fields.organisation}>
            <input value={form.organisation} onChange={set('organisation')} className={FIELD} />
          </Field>
          <button type="submit" className={`${SECONDARY} sm:mt-7`}>
            Add speaker
          </button>
        </form>
      )}
      <Notice message={message} />
    </section>
  );
}
