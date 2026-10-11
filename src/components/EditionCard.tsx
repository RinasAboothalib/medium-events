import React from 'react';
import { Calendar, MapPin, Users, ExternalLink } from 'lucide-react';
import { PastEvent } from '../types';
import { trackEvent } from '../lib/analytics';

// One past edition of an event series, with its banner from the Facebook event
export const EditionCard: React.FC<{ event: PastEvent; showSeries?: boolean }> = ({ event, showSeries = false }) => (
  <article className="h-full flex flex-col rounded-lg border border-line bg-white overflow-hidden">
    {event.image && (
      <div className="aspect-[2/1] bg-surface overflow-hidden">
        <img
          src={event.image}
          alt={`${event.name} banner`}
          width={960}
          height={480}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      </div>
    )}
    <div className="p-5 flex flex-col flex-grow">
      {showSeries && <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand mb-2">{event.series}</p>}
      <h3 className="text-lg font-semibold text-ink">{event.name}</h3>
      <ul className="mt-3 space-y-1.5 text-sm text-body">
        <li className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted flex-shrink-0" aria-hidden="true" />
          {event.date}
        </li>
        <li className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-muted flex-shrink-0 mt-0.5" aria-hidden="true" />
          {event.venue}
        </li>
        {event.responded > 0 && (
          <li className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted flex-shrink-0" aria-hidden="true" />
            {event.responded} responded on Facebook
          </li>
        )}
      </ul>
      {event.facebookUrl && (
        <a
          href={event.facebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent('facebook_event_click', { event_id: event.id })}
          className="mt-auto pt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-hover focus-visible:outline-2 focus-visible:outline-brand rounded-sm"
        >
          View on Facebook
          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
        </a>
      )}
    </div>
  </article>
);
