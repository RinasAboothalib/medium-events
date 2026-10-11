import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { addNote, getEnquiry, saveEnquiry, SOURCE_LABELS, STATUS_LABELS, type EnquiryInput } from '../lib/enquiries';
import { listStaff } from '../lib/staff';
import { can } from '../lib/permissions';
import { formatWhen } from '../lib/dates';
import { useLoad } from '../lib/useLoad';
import type { EnquirySource, EnquiryStatus } from '../lib/types';
import { FIELD, Field, LINK, Loading, Notice, PageHeader, PRIMARY, SECONDARY, type Message } from '../components/ui';

const NEW_FIELDS = [
  ['full_name', 'Name'],
  ['company', 'Company'],
  ['email', 'Email'],
  ['phone', 'Phone'],
  ['service', 'Interested in'],
  ['event', 'Event'],
  ['timeline', 'Timeline'],
  ['budget', 'Budget'],
] as const;

// /enquiries/new records an enquiry by hand; /enquiries/:id shows one and lets sales work it
export default function EnquiryPage() {
  const { id = 'new' } = useParams();
  return id === 'new' ? <NewEnquiry /> : <EnquiryDetail id={id} />;
}

function NewEnquiry() {
  const navigate = useNavigate();
  const [form, setForm] = useState<Record<string, string>>({ source: 'phone' });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<Message>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const result = await saveEnquiry(null, { ...form, full_name: form.full_name ?? '' } as EnquiryInput);
    setBusy(false);
    if (result.ok) return navigate(`/enquiries/${result.value.id}`, { replace: true });
    setFields(result.fields ?? {});
    setMessage({ kind: 'error', text: result.error });
  };

  return (
    <section className="max-w-3xl">
      <PageHeader title="Add enquiry" intro="For leads that came in by phone, WhatsApp, email or in person." back={{ to: '/enquiries', label: 'All enquiries' }} />
      <Notice message={message} />
      <form onSubmit={submit} noValidate className="mt-6 rounded-lg border border-line bg-white p-5 grid gap-4 sm:grid-cols-2">
        {NEW_FIELDS.map(([key, label]) => (
          <Field key={key} id={`n-${key}`} label={label} error={fields[key]}>
            <input type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} value={form[key] ?? ''} onChange={set(key)} className={FIELD} />
          </Field>
        ))}
        <Field id="n-source" label="Came in by" error={fields.source}>
          <select value={form.source} onChange={set('source')} className={FIELD}>
            {(Object.keys(SOURCE_LABELS) as EnquirySource[]).map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field id="n-message" label="Message" error={fields.message} className="sm:col-span-2">
          <textarea rows={4} value={form.message ?? ''} onChange={set('message')} className={FIELD} />
        </Field>
        <div className="sm:col-span-2">
          <button type="submit" disabled={busy} className={PRIMARY}>
            Save enquiry
          </button>
        </div>
      </form>
    </section>
  );
}

function EnquiryDetail({ id }: { id: string }) {
  const { data: enquiry, error, reload } = useLoad(() => getEnquiry(id), [id]);
  const { data: staff } = useLoad(listStaff, []);
  const [status, setStatus] = useState<EnquiryStatus>('new');
  const [assignee, setAssignee] = useState('');
  const [message, setMessage] = useState<Message>(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);

  useEffect(() => {
    if (!enquiry) return;
    setStatus(enquiry.status);
    setAssignee(enquiry.assignee_id ?? '');
  }, [enquiry]);

  if (error) return <p role="alert" className="text-sm text-red-700">{error}</p>;
  if (!enquiry) return <Loading />;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    // Send only what changed, so the activity log shows exactly that
    const patch: EnquiryInput = {};
    if (status !== enquiry.status) patch.status = status;
    if ((assignee || null) !== enquiry.assignee_id) patch.assignee_id = assignee || null;
    const result = await saveEnquiry(id, patch);
    setMessage(result.ok ? { kind: 'success', text: 'Saved.' } : { kind: 'error', text: result.error });
    if (result.ok) await reload();
  };

  const submitNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return setNoteError('Write a note.');
    const result = await addNote(id, note.trim());
    if (!result.ok) return setNoteError(result.error);
    setNote('');
    setNoteError(null);
    await reload();
  };

  const details: [string, React.ReactNode][] = [
    ['Company', enquiry.company],
    ['Email', enquiry.email && <a href={`mailto:${enquiry.email}`} className={LINK}>{enquiry.email}</a>],
    ['Phone', enquiry.phone && <a href={`tel:${enquiry.phone.replace(/\s/g, '')}`} className={LINK}>{enquiry.phone}</a>],
    ['Interested in', enquiry.service],
    ['Event', enquiry.event],
    ['Timeline', enquiry.timeline],
    ['Budget', enquiry.budget],
    ['Received', `${formatWhen(enquiry.created_at)} · ${SOURCE_LABELS[enquiry.source]}`],
  ];
  // Active admins and sales staff (the people who can open enquiries); whoever is already assigned stays selectable
  const assignable = (staff ?? []).filter((p) => (p.active && can(p.role, 'enquiries.access')) || p.id === enquiry.assignee_id);

  return (
    <section className="max-w-4xl">
      <PageHeader title={enquiry.full_name} intro={enquiry.company || undefined} back={{ to: '/enquiries', label: 'All enquiries' }} />
      <Notice message={message} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="rounded-lg border border-line bg-white p-5">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            {details
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <React.Fragment key={label}>
                  <dt className="text-muted">{label}</dt>
                  <dd className="text-ink break-words">{value}</dd>
                </React.Fragment>
              ))}
          </dl>
          {enquiry.message && <p className="mt-4 whitespace-pre-line border-t border-line pt-4 text-sm text-body">{enquiry.message}</p>}
        </div>

        <form onSubmit={save} className="rounded-lg border border-line bg-white p-5 space-y-4 self-start">
          <Field id="d-status" label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value as EnquiryStatus)} className={FIELD}>
              {(Object.keys(STATUS_LABELS) as EnquiryStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="d-assignee" label="Assigned to">
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={FIELD}>
              <option value="">Nobody yet</option>
              {assignable.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </Field>
          <button type="submit" className={PRIMARY}>
            Save changes
          </button>
        </form>
      </div>

      <section aria-labelledby="notes-title" className="mt-10">
        <h2 id="notes-title" className="text-lg font-semibold text-ink">Notes</h2>
        <form onSubmit={submitNote} noValidate className="mt-3 space-y-2">
          <label htmlFor="d-note" className="block text-sm font-semibold text-ink">New note</label>
          <textarea id="d-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={FIELD} placeholder="Calls, quotes sent, next steps…" />
          {noteError && <p role="alert" className="text-sm text-red-700">{noteError}</p>}
          <button type="submit" className={SECONDARY}>
            Add note
          </button>
        </form>
        <ul className="mt-4 space-y-3">
          {enquiry.notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-line bg-white p-4 text-sm">
              <p className="whitespace-pre-line text-ink">{n.body}</p>
              <p className="mt-2 text-xs text-muted">
                {n.author_name ?? 'Former staff'} · {formatWhen(n.created_at)}
              </p>
            </li>
          ))}
          {enquiry.notes.length === 0 && <li className="text-sm text-muted">No notes yet.</li>}
        </ul>
      </section>
    </section>
  );
}
