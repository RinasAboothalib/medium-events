import React from 'react';

interface PartnerStripProps {
  partners: { name: string; role: string }[];
  title?: string;
}

export const PartnerStrip: React.FC<PartnerStripProps> = ({ partners, title = 'Partners and sponsors' }) => (
  <div>
    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted mb-5">{title}</p>
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {partners.map((partner) => (
        <li key={`${partner.name}-${partner.role}`} className="bg-white border border-line rounded-lg px-5 py-4">
          <p className="text-base font-semibold text-ink">{partner.name}</p>
          <p className="text-sm text-muted mt-0.5">{partner.role}</p>
        </li>
      ))}
    </ul>
  </div>
);
