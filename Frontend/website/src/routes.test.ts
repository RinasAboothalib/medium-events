import { describe, expect, it } from 'vitest';
import { MAIN_ROUTES, ROUTES, contactPath, legacyHashToPath, pathFor, routeForPath, seriesPath } from './routes';

describe('ROUTES', () => {
  it('lists the six main pages in navigation order', () => {
    expect(MAIN_ROUTES.map((r) => r.path)).toEqual(['/', '/events', '/services', '/about', '/news', '/contact']);
    expect(MAIN_ROUTES.map((r) => r.navLabel)).toEqual(['Home', 'Events', 'Services', 'About', 'News', 'Contact']);
  });

  it('adds a page for each event series', () => {
    expect(ROUTES).toHaveLength(10);
    expect(ROUTES.filter((r) => r.kind === 'series').map((r) => r.path)).toEqual([
      '/events/construction-industry-forum',
      '/events/marine-industry-forum',
      '/events/aviation-forum',
      '/events/build-expo',
    ]);
    const buildExpo = ROUTES.find((r) => r.path === '/events/build-expo')!;
    expect(buildExpo.title).toBe('Build Expo | MEDIUM Events Maldives');
    expect(buildExpo.ogImage).toBe('/images/fb/build-expo-2025.jpg');
    expect(seriesPath('aviation-forum')).toBe('/events/aviation-forum');
  });

  it('gives every page a unique title and a description', () => {
    expect(new Set(ROUTES.map((r) => r.title)).size).toBe(ROUTES.length);
    for (const r of ROUTES) expect(r.description.length).toBeGreaterThan(40);
    for (const r of ROUTES) expect(r.description.length).toBeLessThanOrEqual(160);
  });

  it('uses the Ooredoo signing photo as the News share image and the CIF collage elsewhere', () => {
    expect(ROUTES.find((r) => r.id === 'news')!.ogImage).toBe('/images/fb/ooredoo-cif-2026-signing.jpg');
    expect(ROUTES.find((r) => r.id === 'events')!.ogImage).toBe('/images/fb/cif-2025.jpg');
  });
});

describe('pathFor / routeForPath', () => {
  it('maps ids to paths', () => {
    expect(pathFor('news')).toBe('/news');
    expect(pathFor('home')).toBe('/');
  });

  it('finds routes with or without a trailing slash', () => {
    expect(routeForPath('/events/')!.id).toBe('events');
    expect(routeForPath('/events')!.id).toBe('events');
    expect(routeForPath('/')!.id).toBe('home');
    expect(routeForPath('/nope')).toBeUndefined();
    expect(routeForPath('/events/build-expo/')!.seriesSlug).toBe('build-expo');
  });
});

describe('legacyHashToPath', () => {
  it('maps every legacy hash to its new page', () => {
    expect(legacyHashToPath('#home')).toBe('/');
    expect(legacyHashToPath('#services')).toBe('/services');
    expect(legacyHashToPath('#events')).toBe('/events');
    expect(legacyHashToPath('#about')).toBe('/about');
    expect(legacyHashToPath('#info-center')).toBe('/news');
    expect(legacyHashToPath('enquiry')).toBe('/contact');
  });

  it('returns null for unknown or empty hashes', () => {
    expect(legacyHashToPath('#nope')).toBeNull();
    expect(legacyHashToPath('')).toBeNull();
    expect(legacyHashToPath('#')).toBeNull();
  });
});

describe('contactPath', () => {
  it('is plain /contact without options', () => {
    expect(contactPath()).toBe('/contact');
  });

  it('round-trips event names containing special characters', () => {
    const name = 'Aviation Forum – Connecting Maldives (AF) & more';
    const p = contactPath({ event: name });
    expect(new URL(p, 'https://x').pathname).toBe('/contact');
    expect(new URL(p, 'https://x').searchParams.get('event')).toBe(name);
  });

  it('links the header sponsor button to the sponsorship enquiry', () => {
    expect(contactPath({ service: 'sponsorship' })).toBe('/contact?service=sponsorship');
  });

  it('carries a service id', () => {
    expect(new URL(contactPath({ service: 'design' }), 'https://x').searchParams.get('service')).toBe('design');
  });
});
