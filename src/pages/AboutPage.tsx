import React from 'react';
import { CtaBand, PageHeader, PartnerStrip, Section, SectionHeader, StatStrip } from '../components/ui';
import { SITE_STATS, VERIFIED_PARTNERS } from '../data/websiteData';
import { contactPath, pathFor } from '../routes';

// Principles from MEDIUM's own site (medium.mv), in plain English
const PRINCIPLES = [
  { title: 'We know the market', text: 'We know the Maldives market, and we know your customers.' },
  { title: 'Quality first', text: 'Every idea is developed for the client in front of us, not reused from the last one.' },
  { title: 'Results you can see', text: 'Campaigns are planned around measurable results, so your budget is put to work.' },
  { title: 'In it for the long term', text: 'For selected clients we run long-term marketing plans, not one-off projects.' },
  { title: 'Easy to start', text: "Reach out with what you need and we'll take it from there." },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About MEDIUM"
        title="A creative and events company built in the Maldives"
        intro="MEDIUM Events Pvt Ltd is based in Malé. We organise national industry forums and exhibitions, and deliver advertising, design and creative consultancy for organisations across the Maldives."
      />

      <Section>
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionHeader eyebrow="Who we are" title="Experience you can call on" />
          </div>
          <div className="lg:col-span-7 space-y-4 text-lg leading-relaxed text-body">
            <p>
              Our management team brings over 60 years of combined experience, with more than 15 years each in their
              fields. Between them they cover events, advertising, design and production.
            </p>
            <p>
              Since 2023 we have organised the Construction Industry Forum, the Maldives Marine Industry Forum, the
              Aviation Forum and Build Expo, bringing government and private-sector leaders into the same room.
            </p>
          </div>
        </div>
      </Section>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        <StatStrip stats={SITE_STATS} />
      </div>

      <Section>
        <SectionHeader eyebrow="Principles" title="How we work" />
        <ul aria-label="How we work" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {PRINCIPLES.map((principle, i) => (
            <li key={principle.title} className="rounded-lg border border-line bg-white p-6">
              <p className="text-sm font-semibold text-brand">0{i + 1}</p>
              <h3 className="mt-3 text-lg font-semibold text-ink">{principle.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-body">{principle.text}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="surface">
        <PartnerStrip partners={VERIFIED_PARTNERS} title="Who we work with" />
      </Section>

      <CtaBand
        title="Work with us."
        text="Sponsor one of our forums, exhibit at Build Expo, or brief us on a campaign."
        primary={{ label: 'Become a sponsor', to: contactPath({ service: 'sponsorship' }) }}
        secondary={{ label: 'Contact us', to: pathFor('contact') }}
      />
    </>
  );
}
