// Single source of truth for pages: drives the router, pre-rendering, sitemap and build check.
import { EVENT_SERIES, editionsFor } from './data/websiteData';

export type MainPageId = 'home' | 'events' | 'services' | 'about' | 'news' | 'contact';
export type PageId = MainPageId | `series-${string}`;

export interface RouteMeta {
  id: PageId;
  kind: 'main' | 'series';
  path: string;
  navLabel: string;
  title: string;
  description: string;
  ogImage: string;
  seriesSlug?: string;
}

const DEFAULT_OG_IMAGE = '/images/fb/cif-2025.jpg';

export const MAIN_ROUTES: RouteMeta[] = [
  {
    id: 'home',
    kind: 'main',
    path: '/',
    navLabel: 'Home',
    title: 'MEDIUM Events | Forums, expos and creative agency in the Maldives',
    description:
      'MEDIUM Events organises the Construction Industry Forum, Marine Industry Forum, Aviation Forum and Build Expo, and runs advertising and design in the Maldives.',
    ogImage: DEFAULT_OG_IMAGE,
  },
  {
    id: 'events',
    kind: 'main',
    path: '/events',
    navLabel: 'Events',
    title: 'Events | MEDIUM Events Maldives',
    description:
      'Construction Industry Forum, Maldives Marine Industry Forum, Aviation Forum and Build Expo: the forums and expos MEDIUM has organised since 2023.',
    ogImage: DEFAULT_OG_IMAGE,
  },
  {
    id: 'services',
    kind: 'main',
    path: '/services',
    navLabel: 'Services',
    title: 'Services | MEDIUM Events Maldives',
    description:
      'Events, advertising and marketing, design and production, and creative consultancy for organisations and brands across the Maldives.',
    ogImage: DEFAULT_OG_IMAGE,
  },
  {
    id: 'about',
    kind: 'main',
    path: '/about',
    navLabel: 'About',
    title: 'About | MEDIUM Events Maldives',
    description:
      'A creative and events company in Malé with over 60 years of combined experience, working with MNACI, Ooredoo Maldives, SITA and industry leaders.',
    ogImage: DEFAULT_OG_IMAGE,
  },
  {
    id: 'news',
    kind: 'main',
    path: '/news',
    navLabel: 'News',
    title: 'News | MEDIUM Events Maldives',
    description:
      'Announcements from MEDIUM Events: sponsorship signings, forum dates and updates from our construction, marine and aviation forums and Build Expo.',
    ogImage: '/images/fb/ooredoo-cif-2026-signing.jpg',
  },
  {
    id: 'contact',
    kind: 'main',
    path: '/contact',
    navLabel: 'Contact',
    title: 'Contact and sponsorship | MEDIUM Events Maldives',
    description:
      'Enquire about sponsorship, an exhibition stand or a campaign. Reach MEDIUM Events in Malé by form, WhatsApp, phone or email.',
    ogImage: DEFAULT_OG_IMAGE,
  },
];

export function seriesPath(slug: string): string {
  return `/events/${slug}`;
}

const SERIES_ROUTES: RouteMeta[] = EVENT_SERIES.map((series) => {
  const editions = editionsFor(series.series);
  const firstYear = editions[editions.length - 1].isoDate.slice(0, 4);
  return {
    id: `series-${series.slug}`,
    kind: 'series',
    path: seriesPath(series.slug),
    navLabel: series.shortName,
    title: `${series.name} | MEDIUM Events Maldives`,
    description: `${series.tagline} ${editions.length} ${editions.length === 1 ? 'edition' : 'editions'} since ${firstYear}.`,
    ogImage: editions[0].image,
    seriesSlug: series.slug,
  };
});

export const ROUTES: RouteMeta[] = [...MAIN_ROUTES, ...SERIES_ROUTES];

export function pathFor(id: MainPageId): string {
  return MAIN_ROUTES.find((r) => r.id === id)!.path;
}

export function routeForPath(pathname: string): RouteMeta | undefined {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return ROUTES.find((r) => r.path === (normalized || '/'));
}

export function contactPath(opts: { service?: string; event?: string } = {}): string {
  const params = new URLSearchParams();
  if (opts.service) params.set('service', opts.service);
  if (opts.event) params.set('event', opts.event);
  const query = params.toString();
  return query ? `/contact?${query}` : '/contact';
}

// Section ids used by the old single-page hash navigation (e.g. links shared on Facebook)
const LEGACY_HASHES: Record<string, MainPageId> = {
  home: 'home',
  services: 'services',
  events: 'events',
  about: 'about',
  'info-center': 'news',
  enquiry: 'contact',
};

export function legacyHashToPath(hash: string): string | null {
  const key = hash.replace(/^#/, '');
  return Object.hasOwn(LEGACY_HASHES, key) ? pathFor(LEGACY_HASHES[key]) : null;
}
