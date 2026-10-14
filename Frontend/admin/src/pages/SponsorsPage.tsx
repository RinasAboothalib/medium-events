import React, { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../lib/auth';
import { can } from '../lib/permissions';
import { listSponsors, saveSponsor } from '../lib/sales';
import { useLoad } from '../lib/useLoad';
import { FIELD, LINK, Loading, Notice, PageHeader, SECONDARY, TABLE_WRAP, TD, TH, type Message } from '../components/ui';

const EMPTY = { company: '', contact_name: '', email: '', phone: '' };

export default function SponsorsPage() {
  const { role } = useAuth();
  const canWrite = can(role, 'sponsors.write');
  const { data: sponsors, error, reload } = useLoad(listSponsors, []);
  const [form, setForm] = useState(EMPTY);
  const [message, setMessage] = useState<Message>(null);
  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await saveSponsor(null, form);
    if (!result.ok) return setMessage({ kind: 'error', text: result.fields ? Object.values(result.fields)[0] : result.error });
    setForm(EMPTY);
    setMessage({ kind: 'success', text: `Added ${result.value.company}.` });
    await reload();
  };

  return (
    <section>
      <PageHeader title="Sponsors" intro="Companies that sponsor or exhibit at MEDIUM events. Open one to see its deals." />

      {canWrite && (
        <form onSubmit={add} noValidate aria-label="Add sponsor" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] items-end rounded-lg border border-line bg-white p-4">
          {([['company', 'Company'], ['contact_name', 'Contact name'], ['email', 'Email'], ['phone', 'Phone']] as const).map(([key, label]) => (
            <div key={key}>
              <label htmlFor={`sp-${key}`} className="block text-sm font-semibold text-ink mb-1.5">{label}</label>
              <input id={`sp-${key}`} type={key === 'email' ? 'email' : 'text'} value={form[key]} onChange={set(key)} className={FIELD} />
            </div>
          ))}
          <button type="submit" className={SECONDARY}>
            Add sponsor
          </button>
        </form>
      )}
      <Notice message={message} />

      {error ? (
        <p role="alert" className="mt-6 text-sm text-red-700">{error}</p>
      ) : !sponsors ? (
        <Loading />
      ) : (
        <div className={TABLE_WRAP}>
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-surface text-left text-xs font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th scope="col" className={TH}>Company</th>
                <th scope="col" className={TH}>Contact</th>
                <th scope="col" className={TH}>Email</th>
                <th scope="col" className={TH}>Phone</th>
                <th scope="col" className={TH}>Deals</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sponsors.map((s) => (
                <tr key={s.id}>
                  <td className={TD}>
                    <Link to={`/sponsors/${s.id}`} className={LINK}>
                      {s.company}
                    </Link>
                  </td>
                  <td className={`${TD} text-body`}>{s.contact_name}</td>
                  <td className={`${TD} text-body break-all`}>{s.email}</td>
                  <td className={`${TD} text-body whitespace-nowrap`}>{s.phone}</td>
                  <td className={`${TD} text-body`}>{s.deal_count}</td>
                </tr>
              ))}
              {sponsors.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">
                    No sponsors yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
