import React from 'react';
import { ArrowRight, BadgeCheck } from 'lucide-react';
import { Card, CtaBand, FadeIn, PageHeader, Section, SectionHeader } from '../components/ui';
import { PastEventsSection } from '../components/PastEventsSection';
import { EVENT_SERIES, editionsFor } from '../data/websiteData';
import { contactPath, pathFor, seriesPath } from '../routes';

export default function EventsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Forums and exhibitions"
        title="Events"
        intro="MEDIUM organises four series that bring together government and private-sector decision makers from the Maldives' construction, marine and aviation industries."
      />

      <Section>
        <SectionHeader eyebrow="Event series" title="Choose a series" />
        <div className="grid gap-6 md:grid-cols-2">
          {EVENT_SERIES.map((series, i) => {
            const editions = editionsFor(series.series);
            return (
              <FadeIn key={series.slug} delay={i * 0.05}>
                <Card to={seriesPath(series.slug)} className="overflow-hidden grid sm:grid-cols-5">
                  <div className="sm:col-span-2 aspect-[2/1] sm:aspect-auto bg-surface">
                    <img src={editions[0].image} alt="" width={960} height={480} loading="lazy" className="w-full h-full object-cover" />
                  </div>
                  <div className="sm:col-span-3 p-6 flex flex-col">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{series.shortName}</p>
                    <h3 className="mt-2 text-xl font-semibold text-ink">{series.name}</h3>
                    <p className="mt-2 text-sm text-body leading-relaxed">{series.tagline}</p>
                    {series.endorsement && (
                      <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink">
                        <BadgeCheck className="w-4 h-4 text-brand" aria-hidden="true" />
                        {series.endorsement}
                      </p>
                    )}
                    <p className="mt-auto pt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
                      {editions.length} {editions.length === 1 ? 'edition' : 'editions'} · View series
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </p>
                  </div>
                </Card>
              </FadeIn>
            );
          })}
        </div>
      </Section>

      <PastEventsSection />

      <CtaBand
        title="Put your brand in front of the decision makers."
        text="Sponsorship and exhibition packages for every series."
        primary={{ label: 'Become a sponsor', to: contactPath({ service: 'sponsorship' }) }}
        secondary={{ label: 'Contact us', to: pathFor('contact') }}
      />
    </>
  );
}
