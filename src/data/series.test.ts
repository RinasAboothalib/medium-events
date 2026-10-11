import { describe, expect, it } from 'vitest';
import {
  EVENT_SERIES,
  PAST_EVENTS_DATA,
  SERVICE_OPTIONS,
  SITE_STATS,
  VERIFIED_PARTNERS,
  editionsFor,
  seriesBySlug,
} from './websiteData';

describe('EVENT_SERIES', () => {
  it('has the four series with unique slugs', () => {
    expect(EVENT_SERIES.map((s) => s.slug)).toEqual([
      'construction-industry-forum',
      'marine-industry-forum',
      'aviation-forum',
      'build-expo',
    ]);
  });

  it('links every past event to a series and every series to at least one edition', () => {
    const seriesNames = EVENT_SERIES.map((s) => s.series);
    for (const event of PAST_EVENTS_DATA) expect(seriesNames).toContain(event.series);
    for (const series of EVENT_SERIES) expect(editionsFor(series.series).length).toBeGreaterThan(0);
  });

  it('lists editions newest first', () => {
    expect(editionsFor('Construction Industry Forum').map((e) => e.id)).toEqual(['cif-2025', 'cif-2024', 'cif-2023']);
  });

  it('looks series up by slug', () => {
    expect(seriesBySlug('build-expo')!.ctaSecondary).toBe('Book a stand');
    expect(seriesBySlug('aviation-forum')!.name).toBe('Aviation Forum – Connecting Maldives');
    expect(seriesBySlug('nope')).toBeUndefined();
  });

  it('records only verified partners', () => {
    expect(seriesBySlug('construction-industry-forum')!.partners.map((p) => p.name)).toEqual(['MNACI', 'Ooredoo Maldives']);
    expect(seriesBySlug('aviation-forum')!.partners.map((p) => p.name)).toEqual(['SITA']);
    expect(VERIFIED_PARTNERS.map((p) => p.name)).toEqual(['MNACI', 'Ooredoo Maldives', 'SITA']);
  });
});

describe('site stats', () => {
  it('derives counts from the event data', () => {
    expect(SITE_STATS).toEqual([
      { value: '9', label: 'events hosted' },
      { value: '4', label: 'event series' },
      { value: '2023', label: 'first forum' },
      { value: '60+', label: 'years combined experience' },
    ]);
  });
});

describe('SERVICE_OPTIONS', () => {
  it('offers sponsorship as a selectable enquiry type', () => {
    expect(SERVICE_OPTIONS).toContainEqual({ id: 'sponsorship', label: 'Sponsorship or exhibition stand' });
    expect(SERVICE_OPTIONS.map((o) => o.id)).toEqual(['sponsorship', 'events', 'advertising', 'design', 'consultancy', 'general']);
  });
});
