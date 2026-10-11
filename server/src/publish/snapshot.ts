// Builds the data the public website is generated from. Shapes match the site's EventSeries and PastEvent
// types (src/types.ts), so the site can use a published snapshot in place of its built-in data.
import type { Db } from '../db/index.js';

export interface SiteSeries {
  slug: string;
  name: string;
  shortName: string;
  series: string;
  tagline: string;
  description: string[];
  website?: string;
  endorsement?: string;
  audience: string;
  usualVenue: string;
  usualMonth: string;
  partners: { name: string; role: string }[];
  ctaSecondary?: string;
}

export interface SiteEvent {
  id: string;
  name: string;
  series: string;
  date: string;
  isoDate: string;
  venue: string;
  description: string;
  responded: number;
  image: string;
  facebookUrl: string;
}

export interface SiteSnapshot {
  published_at: string;
  series: SiteSeries[];
  events: SiteEvent[];
  upcoming: SiteEvent[];
  partners: { name: string; role: string }[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// "Tue, 12 May 2026" · "24 – 27 Apr 2025" · "30 Apr – 2 May 2025" · "30 Dec 2025 – 2 Jan 2026"
export function formatEventDate(start: string, end: string | null): string {
  const [sy, sm, sd] = start.split('-').map(Number);
  if (!end || end === start) {
    const weekday = DAYS[new Date(Date.UTC(sy, sm - 1, sd)).getUTCDay()];
    return `${weekday}, ${sd} ${MONTHS[sm - 1]} ${sy}`;
  }
  const [ey, em, ed] = end.split('-').map(Number);
  if (sy !== ey) return `${sd} ${MONTHS[sm - 1]} ${sy} – ${ed} ${MONTHS[em - 1]} ${ey}`;
  if (sm !== em) return `${sd} ${MONTHS[sm - 1]} – ${ed} ${MONTHS[em - 1]} ${ey}`;
  return `${sd} – ${ed} ${MONTHS[em - 1]} ${ey}`;
}

// Optional text: left out of the snapshot when empty, as in the site's built-in data
const opt = <K extends string>(key: K, value: string | null) => (value ? ({ [key]: value } as Record<K, string>) : {});

export async function buildSnapshot(db: Db, at = new Date()): Promise<SiteSnapshot> {
  const seriesRows = await db.query<{
    id: string;
    slug: string;
    name: string;
    label: string;
    short_name: string;
    tagline: string;
    description: string[];
    website: string | null;
    endorsement: string | null;
    audience: string;
    usual_venue: string;
    usual_month: string;
    cta_secondary: string | null;
  }>('select * from event_series where active order by sort_order, name');
  const seriesIds = seriesRows.map((s) => s.id);

  const partnerRows = await db.query<{ name: string; role: string; series_id: string | null; edition_id: string | null }>(
    `select p.name, p.role, p.series_id, p.edition_id
       from partners p
       left join editions e on e.id = p.edition_id
       join event_series s on s.id = coalesce(p.series_id, e.series_id)
      where s.active and (e.id is null or e.status <> 'cancelled')
      order by s.sort_order, p.edition_id nulls first, p.sort_order, p.name`,
  );

  const editionRows = await db.query<{
    id: string;
    series_id: string;
    name: string;
    start_date: string;
    end_date: string | null;
    venue: string;
    description: string;
    rsvp_count: number | null;
    facebook_url: string | null;
    banner_file_id: string | null;
    status: string;
  }>(
    `select id, series_id, name, start_date::text as start_date, end_date::text as end_date, venue, description, rsvp_count,
            facebook_url, banner_file_id, status
       from editions where status <> 'cancelled' order by start_date desc, name`,
  );

  const label = new Map(seriesRows.map((s) => [s.id, s.label]));
  const toEvent = (e: (typeof editionRows)[number]): SiteEvent => ({
    id: e.id,
    name: e.name,
    series: label.get(e.series_id)!,
    date: formatEventDate(e.start_date, e.end_date),
    isoDate: e.start_date,
    venue: e.venue,
    description: e.description,
    responded: e.rsvp_count ?? 0,
    image: e.banner_file_id ? `/api/public/files/${e.banner_file_id}` : '',
    facebookUrl: e.facebook_url ?? '',
  });
  const active = editionRows.filter((e) => seriesIds.includes(e.series_id));

  // Every partner once, with all of their roles
  const roles = new Map<string, string[]>();
  for (const p of partnerRows) {
    const list = roles.get(p.name) ?? [];
    if (p.role && !list.includes(p.role)) list.push(p.role);
    roles.set(p.name, list);
  }

  return {
    published_at: at.toISOString(),
    series: seriesRows.map((s) => ({
      slug: s.slug,
      name: s.name,
      shortName: s.short_name,
      series: s.label,
      tagline: s.tagline,
      description: s.description,
      ...opt('website', s.website),
      ...opt('endorsement', s.endorsement),
      audience: s.audience,
      usualVenue: s.usual_venue,
      usualMonth: s.usual_month,
      partners: partnerRows.filter((p) => p.series_id === s.id).map((p) => ({ name: p.name, role: p.role })),
      ...opt('ctaSecondary', s.cta_secondary),
    })),
    events: active.filter((e) => e.status === 'past').map(toEvent),
    upcoming: active.filter((e) => e.status === 'upcoming').map(toEvent),
    partners: [...roles].map(([name, list]) => ({ name, role: list.join('; ') })),
  };
}
