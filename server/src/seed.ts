// Loads MEDIUM's real event series, past editions, banners and partners (server/seed/, copied from the
// website's verified data) the first time the server starts, so the admin never starts empty.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Db } from './db/index.js';
import { recordActivity } from './activity.js';

const MARKER = 'seed:events-v1';

interface SeedFile {
  series: {
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
    sort_order: number;
    partners: { name: string; role: string }[];
  }[];
  editions: {
    series_slug: string;
    name: string;
    start_date: string;
    end_date: string | null;
    venue: string;
    description: string;
    rsvp_count: number;
    facebook_url: string;
    banner: string;
  }[];
}

// Recorded in schema_migrations, so deleting the seeded rows later never brings them back
export async function seedEvents(db: Db, dir: string): Promise<'seeded' | 'skipped'> {
  return db.transaction(async (tx) => {
    const done = await tx.query('select 1 from schema_migrations where name = $1', [MARKER]);
    if (done.length) return 'skipped';
    const seed = JSON.parse(readFileSync(join(dir, 'events.json'), 'utf8')) as SeedFile;

    const seriesIds = new Map<string, string>();
    for (const s of seed.series) {
      const [row] = await tx.query<{ id: string }>(
        `insert into event_series (slug, name, label, short_name, tagline, description, website, endorsement, audience,
                                   usual_venue, usual_month, cta_secondary, sort_order)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) returning id`,
        [s.slug, s.name, s.label, s.short_name, s.tagline, s.description, s.website, s.endorsement, s.audience, s.usual_venue, s.usual_month, s.cta_secondary, s.sort_order],
      );
      seriesIds.set(s.slug, row.id);
      for (const [i, p] of s.partners.entries()) {
        await tx.query('insert into partners (name, role, series_id, sort_order) values ($1, $2, $3, $4)', [p.name, p.role, row.id, i + 1]);
      }
    }

    for (const e of seed.editions) {
      const data = readFileSync(join(dir, 'images', e.banner));
      const [file] = await tx.query<{ id: string }>(
        "insert into files (filename, content_type, size, data) values ($1, 'image/jpeg', $2, $3) returning id",
        [e.banner, data.length, data],
      );
      await tx.query(
        `insert into editions (series_id, name, start_date, end_date, venue, description, rsvp_count, facebook_url, banner_file_id, status)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'past')`,
        [seriesIds.get(e.series_slug), e.name, e.start_date, e.end_date, e.venue, e.description, e.rsvp_count, e.facebook_url, file.id],
      );
    }

    await recordActivity(tx, {
      actorId: null,
      entity: 'seed',
      entityId: MARKER,
      action: 'create',
      changes: { series: seed.series.length, editions: seed.editions.length },
      at: new Date(),
    });
    await tx.query('insert into schema_migrations (name) values ($1)', [MARKER]);
    return 'seeded';
  });
}
