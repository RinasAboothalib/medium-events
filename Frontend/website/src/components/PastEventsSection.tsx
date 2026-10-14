import React, { useState } from 'react';
import { Facebook } from 'lucide-react';
import { Button, FadeIn, Section, SectionHeader } from './ui';
import { EditionCard } from './EditionCard';
import { PAST_EVENTS_DATA, COMPANY_DETAILS } from '../data/websiteData';
import { PastEvent } from '../types';

type SeriesFilter = 'All' | PastEvent['series'];

const SERIES_FILTERS: SeriesFilter[] = [
  'All',
  'Construction Industry Forum',
  'Marine Industry Forum',
  'Aviation Forum',
  'Build Expo',
];

interface PastEventsSectionProps {
  // When set, shows only the most recent N events without filters or year grouping
  limit?: number;
}

export const PastEventsSection: React.FC<PastEventsSectionProps> = ({ limit }) => {
  const [activeSeries, setActiveSeries] = useState<SeriesFilter>('All');

  const sortedEvents = [...PAST_EVENTS_DATA].sort((a, b) => b.isoDate.localeCompare(a.isoDate));
  const filteredEvents = sortedEvents.filter((e) => activeSeries === 'All' || e.series === activeSeries);
  const visibleEvents = limit ? filteredEvents.slice(0, limit) : filteredEvents;

  const eventsByYear = visibleEvents.reduce<Record<string, PastEvent[]>>((acc, event) => {
    (acc[event.isoDate.slice(0, 4)] ||= []).push(event);
    return acc;
  }, {});
  const years = Object.keys(eventsByYear).sort((a, b) => b.localeCompare(a));
  const firstYear = sortedEvents[sortedEvents.length - 1]?.isoDate.slice(0, 4);

  return (
    <Section tone="surface" id="track-record">
      <SectionHeader
        eyebrow="Track record"
        title="Events we've delivered"
        intro={`Every forum and exhibition MEDIUM has organised since ${firstYear}, with links to the original Facebook events.`}
      />

      {!limit && (
        <div className="flex flex-wrap gap-2 mb-10" role="group" aria-label="Filter by series">
          {SERIES_FILTERS.map((series) => (
            <button
              key={series}
              type="button"
              onClick={() => setActiveSeries(series)}
              aria-pressed={activeSeries === series}
              className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                activeSeries === series
                  ? 'bg-brand border-brand text-white'
                  : 'bg-white border-line text-body hover:border-brand hover:text-brand'
              }`}
            >
              {series}
            </button>
          ))}
        </div>
      )}

      {limit ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visibleEvents.map((event, idx) => (
            <FadeIn key={event.id} delay={idx * 0.05}>
              <EditionCard event={event} showSeries />
            </FadeIn>
          ))}
        </div>
      ) : (
        <div className="space-y-12">
          {years.map((year) => (
            <div key={year}>
              <div className="flex items-center gap-4 mb-6">
                <h3 className="text-2xl font-bold text-ink">{year}</h3>
                <div className="flex-grow h-px bg-line" />
              </div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {eventsByYear[year].map((event, idx) => (
                  <FadeIn key={event.id} delay={idx * 0.05}>
                    <EditionCard event={event} showSeries />
                  </FadeIn>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-12">
        <Button variant="secondary" href={COMPANY_DETAILS.social.facebook} external>
          <Facebook className="w-4 h-4" aria-hidden="true" />
          Follow MEDIUM on Facebook
        </Button>
      </div>
    </Section>
  );
};
