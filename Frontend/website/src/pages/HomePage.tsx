import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Button, Card, Container, CtaBand, FadeIn, PartnerStrip, Section, SectionHeader, StatStrip } from '../components/ui';
import { EditionCard } from '../components/EditionCard';
import { EVENT_SERIES, PAST_EVENTS_DATA, SERVICES_DATA, SITE_STATS, VERIFIED_PARTNERS, editionsFor } from '../data/websiteData';
import { contactPath, pathFor, seriesPath } from '../routes';

const SPONSOR_PATH = contactPath({ service: 'sponsorship' });

const latestEvents = [...PAST_EVENTS_DATA].sort((a, b) => b.isoDate.localeCompare(a.isoDate)).slice(0, 3);

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-18 bg-white">
        <div className="grid lg:grid-cols-2">
          <div className="bg-brand px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-28 flex items-center">
            <div className="max-w-xl lg:ml-auto lg:mr-12 w-full">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-on-brand-muted mb-5">
                Events and creative agency · Malé, Maldives
              </p>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white leading-[1.1]">
                Meet the Maldives' construction, marine and aviation leaders.
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-on-brand-muted">
                MEDIUM Events organises the Construction Industry Forum, the Maldives Marine Industry Forum, the Aviation
                Forum and Build Expo, and delivers advertising, design and creative consultancy for brands across the
                Maldives.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Button variant="inverse" to={SPONSOR_PATH}>
                  Become a sponsor
                </Button>
                <Button variant="inverse-outline" to={pathFor('events')}>
                  Explore events
                </Button>
              </div>
            </div>
          </div>
          <div className="relative min-h-[280px] sm:min-h-[380px] bg-surface">
            <img
              src="/images/fb/ooredoo-cif-2026-signing.jpg"
              alt="Ooredoo Maldives and MEDIUM Events signing the CIF 2026 Exclusive Platinum Sponsorship"
              width={2048}
              height={1365}
              loading="eager"
              fetchPriority="high"
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      <Container className="-mt-px">
        <StatStrip stats={SITE_STATS} />
      </Container>

      {/* Event series */}
      <Section>
        <SectionHeader
          eyebrow="Event series"
          title="Four series. One audience of decision makers."
          intro="Each series brings government and private-sector leaders together around one industry."
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {EVENT_SERIES.map((series, i) => {
            const editions = editionsFor(series.series);
            return (
              <FadeIn key={series.slug} delay={i * 0.05}>
                <Card to={seriesPath(series.slug)} className="group overflow-hidden flex flex-col">
                  <div className="aspect-[2/1] bg-surface overflow-hidden">
                    <img src={editions[0].image} alt="" width={960} height={480} loading="lazy" className="w-full h-full object-cover" />
                  </div>
                  <div className="p-5 flex flex-col flex-grow">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{series.shortName}</p>
                    <h3 className="mt-2 text-lg font-semibold text-ink">{series.name}</h3>
                    <p className="mt-2 text-sm text-body leading-relaxed">{series.tagline}</p>
                    <p className="mt-auto pt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
                      {editions.length} {editions.length === 1 ? 'edition' : 'editions'} since{' '}
                      {editions[editions.length - 1].isoDate.slice(0, 4)}
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </p>
                  </div>
                </Card>
              </FadeIn>
            );
          })}
        </div>
      </Section>

      {/* Latest events */}
      <Section tone="surface">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <SectionHeader eyebrow="Track record" title="Latest events" />
          <Button variant="secondary" to={pathFor('events')} className="sm:mb-10 self-start sm:self-auto">
            All events
          </Button>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {latestEvents.map((event, i) => (
            <FadeIn key={event.id} delay={i * 0.05}>
              <EditionCard event={event} showSeries />
            </FadeIn>
          ))}
        </div>
      </Section>

      {/* Services */}
      <Section>
        <SectionHeader
          eyebrow="What we do"
          title="Events, advertising and design under one roof."
          intro="Over 60 years of combined experience in the Maldives market, with more than 15 years per person in our management team."
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES_DATA.map((service) => (
            <Card key={service.id} to={pathFor('services')} className="p-6">
              <h3 className="text-lg font-semibold text-ink">{service.title}</h3>
              <p className="mt-2 text-sm text-body leading-relaxed">{service.tagline}.</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section tone="surface">
        <PartnerStrip partners={VERIFIED_PARTNERS} />
      </Section>

      <CtaBand
        title="Put your brand in front of the decision makers."
        text="Sponsorship and exhibition packages for every series."
        primary={{ label: 'Become a sponsor', to: SPONSOR_PATH }}
        secondary={{ label: 'Contact us', to: pathFor('contact') }}
      />
    </>
  );
}
