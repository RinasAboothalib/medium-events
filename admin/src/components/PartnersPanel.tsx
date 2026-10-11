import React, { useState } from 'react';
import { deletePartner, listPartners, savePartner } from '../lib/events';
import { useLoad } from '../lib/useLoad';
import { FIELD, Notice, SECONDARY, type Message } from './ui';

// Partners of one series or one edition (sponsors, endorsing associations, …)
export function PartnersPanel({ owner, canWrite }: { owner: { series_id: string } | { edition_id: string }; canWrite: boolean }) {
  const { data: partners, error, reload } = useLoad(() => listPartners(owner), [JSON.stringify(owner)]);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [message, setMessage] = useState<Message>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setMessage({ kind: 'error', text: "Enter the partner's name." });
    const result = await savePartner(null, { name: name.trim(), role: role.trim(), ...owner });
    if (!result.ok) return setMessage({ kind: 'error', text: result.error });
    setName('');
    setRole('');
    setMessage(null);
    await reload();
  };

  const remove = async (id: string) => {
    const result = await deletePartner(id);
    setMessage(result.ok ? null : { kind: 'error', text: result.error });
    await reload();
  };

  return (
    <section aria-labelledby="partners-title" className="mt-10">
      <h2 id="partners-title" className="text-lg font-semibold text-ink">
        Partners
      </h2>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-white">
        {(partners ?? []).map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <span className="min-w-0">
              <span className="font-medium text-ink">{p.name}</span>
              {p.role && <span className="text-body"> · {p.role}</span>}
            </span>
            {canWrite && (
              <button type="button" className={SECONDARY} aria-label={`Remove ${p.name}`} onClick={() => remove(p.id)}>
                Remove
              </button>
            )}
          </li>
        ))}
        {partners?.length === 0 && <li className="px-4 py-3 text-sm text-muted">No partners yet.</li>}
      </ul>
      {canWrite && (
        <form onSubmit={add} noValidate className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
          <div>
            <label htmlFor="partner-name" className="block text-sm font-semibold text-ink mb-1.5">Partner name</label>
            <input id="partner-name" value={name} onChange={(e) => setName(e.target.value)} className={FIELD} />
          </div>
          <div>
            <label htmlFor="partner-role" className="block text-sm font-semibold text-ink mb-1.5">Partner role</label>
            <input id="partner-role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Gold Sponsor" className={FIELD} />
          </div>
          <button type="submit" className={SECONDARY}>
            Add partner
          </button>
        </form>
      )}
      <Notice message={message} />
    </section>
  );
}
