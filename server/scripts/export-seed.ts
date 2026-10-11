// One-off: copies the verified events, series and partners from the website's data into server/seed/,
// so the admin starts with MEDIUM's real events. Run: npx tsx server/scripts/export-seed.ts
import { copyFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { EVENT_SERIES, PAST_EVENTS_DATA } from '../../src/data/websiteData.ts';

const root = join(import.meta.dirname, '..', '..');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "24 – 27 Apr 2025" → 2025-04-27; single-day events have no end date
function endDate(date: string): string | null {
  const m = date.match(/^\d+\s*–\s*(\d+) (\w{3}) (\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${String(MONTHS.indexOf(m[2]) + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

const series = EVENT_SERIES.map((s, i) => ({
  slug: s.slug,
  name: s.name,
  label: s.series,
  short_name: s.shortName,
  tagline: s.tagline,
  description: s.description,
  website: s.website ?? null,
  endorsement: s.endorsement ?? null,
  audience: s.audience,
  usual_venue: s.usualVenue,
  usual_month: s.usualMonth,
  cta_secondary: s.ctaSecondary ?? null,
  sort_order: i + 1,
  partners: s.partners,
}));

const editions = PAST_EVENTS_DATA.map((e) => {
  const image = basename(e.image);
  copyFileSync(join(root, 'public', e.image), join(root, 'server', 'seed', 'images', image));
  return {
    series_slug: EVENT_SERIES.find((s) => s.series === e.series)!.slug,
    name: e.name,
    start_date: e.isoDate,
    end_date: endDate(e.date),
    venue: e.venue,
    description: e.description,
    rsvp_count: e.responded,
    facebook_url: e.facebookUrl,
    banner: image,
  };
});

writeFileSync(join(root, 'server', 'seed', 'events.json'), JSON.stringify({ series, editions }, null, 2) + '\n');
console.log(`Wrote ${series.length} series and ${editions.length} editions`);
