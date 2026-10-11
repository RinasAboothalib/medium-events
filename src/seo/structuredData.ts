import { normalizeSiteUrl } from '../config';
import { COMPANY_DETAILS, PAST_EVENTS_DATA, editionsFor, seriesBySlug } from '../data/websiteData';
import type { PastEvent } from '../types';
import type { RouteMeta } from '../routes';

// schema.org JSON-LD so Google can show MEDIUM's business details and events in search

export function organizationJsonLd(siteUrl: string): object {
  const base = normalizeSiteUrl(siteUrl);
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${base}/#organization`,
    name: COMPANY_DETAILS.name,
    url: `${base}/`,
    email: COMPANY_DETAILS.inquiryEmail,
    telephone: [COMPANY_DETAILS.phone, COMPANY_DETAILS.secondaryPhone, COMPANY_DETAILS.officePhone],
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Champa Building 4, 5th Floor, Orchid Magu',
      addressLocality: 'Malé',
      addressCountry: 'MV',
    },
    sameAs: [COMPANY_DETAILS.social.facebook, COMPANY_DETAILS.social.instagram, COMPANY_DETAILS.social.linkedin],
  };
}

export function pastEventsJsonLd(siteUrl: string, events: PastEvent[] = PAST_EVENTS_DATA): object[] {
  const base = normalizeSiteUrl(siteUrl);
  return events.map((event) => ({
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.name,
    description: event.description,
    startDate: event.isoDate,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    image: `${base}${event.image}`,
    location: {
      '@type': 'Place',
      name: event.venue,
      address: { '@type': 'PostalAddress', addressLocality: event.venue.split(', ').pop(), addressCountry: 'MV' },
    },
    organizer: { '@type': 'Organization', name: COMPANY_DETAILS.name, url: `${base}/` },
  }));
}

export function jsonLdForRoute(route: RouteMeta, siteUrl: string): object[] {
  const org = organizationJsonLd(siteUrl);
  if (route.id === 'events') return [org, ...pastEventsJsonLd(siteUrl)];
  const series = route.seriesSlug ? seriesBySlug(route.seriesSlug) : undefined;
  if (series) return [org, ...pastEventsJsonLd(siteUrl, editionsFor(series.series))];
  return [org];
}
