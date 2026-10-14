import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { listEditions } from '../lib/events';
import { SOURCE_LABELS, STATUS_LABELS } from '../lib/enquiries';
import { DELEGATE_CATEGORY_LABELS, DELEGATE_STATUS_LABELS } from '../lib/operations';
import { can } from '../lib/permissions';
import { useLoad } from '../lib/useLoad';
import type { Edition } from '../lib/types';
import { FIELD, PageHeader, PRIMARY, SECONDARY } from '../components/ui';

// "/api/reports/x.xlsx" + only the filters that are set
function reportUrl(path: string, filters: Record<string, string | undefined>) {
  const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString();
  return `/api/reports/${path}${params ? `?${params}` : ''}`;
}

// Downloads go straight to the server (same origin, so the session cookie is sent); each one is logged
export default function ReportsPage() {
  const { role } = useAuth();
  const { data: editions } = useLoad(() => listEditions(), []);

  return (
    <section className="max-w-3xl">
      <PageHeader title="Reports" intro="Download reports as PDF or Excel. Every download is recorded in the activity log." />
      {can(role, 'reports.postEvent') && <PostEventReport editions={editions ?? []} />}
      {can(role, 'reports.sponsorship') && <SponsorshipReport editions={editions ?? []} />}
      {can(role, 'reports.enquiries') && <EnquiriesReport />}
      {can(role, 'reports.delegates') && <DelegatesReport editions={editions ?? []} />}
      {can(role, 'reports.budget') && <BudgetReport editions={editions ?? []} />}
    </section>
  );
}

function Card({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  const id = title.toLowerCase().replace(/\W+/g, '-');
  return (
    <section aria-labelledby={id} className="mt-6 rounded-lg border border-line bg-white p-5">
      <h2 id={id} className="text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-body">{intro}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EditionSelect({ id, value, onChange, editions, any }: { id: string; value: string; onChange: (v: string) => void; editions: Edition[]; any: string }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-ink mb-1.5">Event</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={FIELD}>
        <option value="">{any}</option>
        {editions.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function DateField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-ink mb-1.5">{label}</label>
      <input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} className={FIELD} />
    </div>
  );
}

function DownloadLink({ href, label, primary = false }: { href: string; label: string; primary?: boolean }) {
  return (
    <a href={href} download className={primary ? PRIMARY : SECONDARY}>
      <Download className="w-4 h-4" aria-hidden="true" />
      {label}
    </a>
  );
}

function PostEventReport({ editions }: { editions: Edition[] }) {
  const [editionId, setEditionId] = useState('');
  return (
    <Card title="Post-event report" intro="One event: dates, venue, attendance, partners, confirmed sponsors (no amounts), outcome notes and the banner.">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] items-end">
        <EditionSelect id="pe-edition" value={editionId} onChange={setEditionId} editions={editions} any="Choose an event" />
        {editionId ? <DownloadLink href={`/api/reports/post-event/${editionId}.pdf`} label="Download PDF" primary /> : <p className="text-sm text-muted pb-2">Choose an event to download.</p>}
      </div>
    </Card>
  );
}

function SponsorshipReport({ editions }: { editions: Edition[] }) {
  const [editionId, setEditionId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  // One event, or every event starting within the dates
  const filters = editionId ? { edition_id: editionId } : { from, to };
  return (
    <Card title="Sponsorship report" intro="Deals with amounts, received and outstanding, totalled per currency. Cancelled deals are listed separately. The Excel file also lists every payment.">
      <div className="grid gap-4 sm:grid-cols-3">
        <EditionSelect id="sp-edition" value={editionId} onChange={setEditionId} editions={editions} any="All events (or use dates)" />
        <DateField id="sp-from" label="From" value={from} onChange={setFrom} />
        <DateField id="sp-to" label="To" value={to} onChange={setTo} />
      </div>
      {editionId && (from || to) && <p className="mt-2 text-xs text-muted">The dates are ignored while an event is chosen.</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        <DownloadLink href={reportUrl('sponsorship.xlsx', filters)} label="Download Excel" primary />
        <DownloadLink href={reportUrl('sponsorship.pdf', filters)} label="Download PDF" />
      </div>
    </Card>
  );
}

function EnquiriesReport() {
  const [f, setF] = useState({ status: '', source: '', from: '', to: '' });
  const set = (key: keyof typeof f) => (value: string) => setF((x) => ({ ...x, [key]: value }));
  const select = (id: string, label: string, key: 'status' | 'source', options: Record<string, string>, all: string) => (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-ink mb-1.5">{label}</label>
      <select id={id} value={f[key]} onChange={(e) => set(key)(e.target.value)} className={FIELD}>
        <option value="">{all}</option>
        {Object.entries(options).map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
  return (
    <Card title="Enquiries report" intro="Every enquiry matching the filters, with contact details, status, who it's assigned to and the latest note.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {select('en-status', 'Status', 'status', STATUS_LABELS, 'All statuses')}
        {select('en-source', 'Source', 'source', SOURCE_LABELS, 'All sources')}
        <DateField id="en-from" label="From" value={f.from} onChange={set('from')} />
        <DateField id="en-to" label="To" value={f.to} onChange={set('to')} />
      </div>
      <div className="mt-4">
        <DownloadLink href={reportUrl('enquiries.xlsx', f)} label="Download Excel" primary />
      </div>
    </Card>
  );
}

function DelegatesReport({ editions }: { editions: Edition[] }) {
  const [f, setF] = useState({ edition_id: '', status: '', category: '' });
  const select = (id: string, label: string, key: 'status' | 'category', options: Record<string, string>, all: string) => (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-ink mb-1.5">{label}</label>
      <select id={id} value={f[key]} onChange={(e) => setF((x) => ({ ...x, [key]: e.target.value }))} className={FIELD}>
        <option value="">{all}</option>
        {Object.entries(options).map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
  return (
    <Card title="Delegates report" intro="The delegate register: contact details, category, status and check-in time for each person.">
      <div className="grid gap-4 sm:grid-cols-3">
        <EditionSelect id="dg-edition" value={f.edition_id} onChange={(v) => setF((x) => ({ ...x, edition_id: v }))} editions={editions} any="All events" />
        {select('dg-status', 'Status', 'status', DELEGATE_STATUS_LABELS, 'All statuses')}
        {select('dg-category', 'Category', 'category', DELEGATE_CATEGORY_LABELS, 'All categories')}
      </div>
      <div className="mt-4">
        <DownloadLink href={reportUrl('delegates.xlsx', f)} label="Download Excel" primary />
      </div>
    </Card>
  );
}

function BudgetReport({ editions }: { editions: Edition[] }) {
  const [editionId, setEditionId] = useState('');
  return (
    <Card title="Budget report" intro="Sponsorship income against expenses per currency, with every expense listed.">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] items-end">
        <EditionSelect id="bg-edition" value={editionId} onChange={setEditionId} editions={editions} any="All events" />
        <DownloadLink href={reportUrl('budget.xlsx', { edition_id: editionId })} label="Download Excel" primary />
      </div>
    </Card>
  );
}
