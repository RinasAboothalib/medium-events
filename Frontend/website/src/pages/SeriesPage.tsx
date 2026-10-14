import React from 'react';
import { BadgeCheck, ExternalLink } from 'lucide-react';
import { Button, CtaBand, FadeIn, PageHeader, PartnerStrip, Section, SectionHeader } from '../components/ui';
import { EditionCard } from '../components/EditionCard';
import { editionsFor } from '../data/websiteData';
import { EventSeries } from '../types';
import { contactPath, pathFor } from '../routes';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function SeriesPage({ series }: { series: EventSeries }) {
  const editions = editionsFor(series.series);
  const firstYear = editions[editions.length - 1].isoDate.slice(0, 4);
  const enquiryPath = contactPath({ event: series.name });

  const facts = [
    { label: 'Editions', value: plural(editions.length, 'edition') },
    { label: 'First held', value: firstYear },
    { label: 'Usually held', value: series.usualMonth },
    { label: 'Venue', value: series.usualVenue },
    { label: 'Who attends', value: series.audience },
  ];

  return (
    <>
      <PageHeader eyebrow="Event series" title={series.name} intro={series.tagline}>
        {series.endorsement && (
          <p className="inline-flex items-center gap-2 rounded-md bg-brand-tint px-3 py-1.5 text-sm font-semibold text-brand mb-6">
            <BadgeCheck className="w-4 h-4" aria-hidden="true" />
            {series.endorsement}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button to={enquiryPath}>Become a sponsor</Button>
          {series.website && (
            <Button variant="secondary" href={series.website} external>
              {series.website.replace('https://', '')}
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </PageHeader>

      <Section>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {facts.map((fact) => (
            <div key={fact.label} className="bg-white border border-line rounded-lg p-5">
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{fact.label}</dt>
              <dd className="mt-2 text-base font-semibold text-ink">{fact.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-14 grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">About the {series.shortName === series.name ? 'event' : series.shortName}</h2>
          </div>
          <div className="lg:col-span-8 space-y-4 text-lg leading-relaxed text-body">
            {series.description.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
      </Section>

      <Section tone="surface">
        <SectionHeader eyebrow="Track record" title="Past editions" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {editions.map((event, i) => (
            <FadeIn key={event.id} delay={i * 0.05}>
              <EditionCard event={event} />
            </FadeIn>
          ))}
        </div>
      </Section>

      {series.partners.length > 0 && (
        <Section>
          <PartnerStrip partners={series.partners} />
        </Section>
      )}

      <CtaBand
        title="Next edition: dates to be announced."
        text="Register your interest and we'll send you sponsorship and exhibition options as soon as dates are set."
        primary={{ label: 'Become a sponsor', to: enquiryPath }}
        secondary={
          series.ctaSecondary
            ? { label: series.ctaSecondary, to: enquiryPath }
            : { label: 'View all events', to: pathFor('events') }
        }
      />
    </>
  );
}
