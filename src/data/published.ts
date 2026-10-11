// Events published from the MEDIUM admin, downloaded at build time by scripts/fetch-site-data.mjs.
// When no published.json exists (no admin configured, or nothing published yet) the site uses its built-in data.
import type { EventSeries, PastEvent } from '../types';

export interface SiteSnapshot {
  published_at: string;
  series: EventSeries[];
  events: PastEvent[];
  upcoming: PastEvent[];
  partners: { name: string; role: string }[];
}

// import.meta.glob returns {} when the file doesn't exist, so the import never breaks the build.
// Tests always use the built-in data, whatever was last published on this machine.
const files = import.meta.glob<SiteSnapshot>('./published.json', { eager: true, import: 'default' });
export const PUBLISHED: SiteSnapshot | null = import.meta.env.MODE === 'test' ? null : (files['./published.json'] ?? null);

interface EventData {
  series: EventSeries[];
  events: PastEvent[];
  partners: { name: string; role: string }[];
}

export function choosePublished(published: SiteSnapshot | null, builtIn: EventData): EventData {
  if (!published) return builtIn;
  return { series: published.series, events: published.events, partners: published.partners };
}
