import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { setup } from './test/helpers.js';
import { seedEvents } from './seed.js';

const SEED_DIR = join(import.meta.dirname, '..', 'seed');
let t: Awaited<ReturnType<typeof setup>>;

beforeEach(async () => {
  t = await setup();
});

describe('seedEvents', () => {
  it("loads MEDIUM's four series in order with their nine past editions", async () => {
    expect(await seedEvents(t.db, SEED_DIR)).toBe('seeded');
    const series = await t.db.query<{ slug: string; label: string }>('select slug, label from event_series order by sort_order');
    expect(series.map((s) => s.slug)).toEqual(['construction-industry-forum', 'marine-industry-forum', 'aviation-forum', 'build-expo']);
    expect(series[1].label).toBe('Marine Industry Forum');
    const editions = await t.db.query<{ status: string; content_type: string; size: number }>(
      'select e.status, f.content_type, f.size from editions e join files f on f.id = e.banner_file_id',
    );
    expect(editions).toHaveLength(9);
    expect(editions.every((e) => e.status === 'past' && e.content_type === 'image/jpeg' && e.size > 0)).toBe(true);
  });

  it('keeps multi-day dates', async () => {
    await seedEvents(t.db, SEED_DIR);
    const [expo] = await t.db.query("select start_date::text, end_date::text from editions where name = 'Build Expo 2025'");
    expect(expo).toEqual({ start_date: '2025-04-24', end_date: '2025-04-27' });
  });

  it('attaches the verified partners to their series', async () => {
    await seedEvents(t.db, SEED_DIR);
    const partners = await t.db.query<{ name: string; slug: string }>(
      'select p.name, s.slug from partners p join event_series s on s.id = p.series_id order by s.sort_order, p.sort_order',
    );
    expect(partners).toEqual([
      { name: 'MNACI', slug: 'construction-industry-forum' },
      { name: 'Ooredoo Maldives', slug: 'construction-industry-forum' },
      { name: 'SITA', slug: 'aviation-forum' },
      { name: 'MNACI', slug: 'build-expo' },
    ]);
  });

  it('runs only once, even after the seeded series are deleted', async () => {
    await seedEvents(t.db, SEED_DIR);
    expect(await seedEvents(t.db, SEED_DIR)).toBe('skipped');
    await t.db.exec('delete from partners; delete from editions; delete from event_series;');
    expect(await seedEvents(t.db, SEED_DIR)).toBe('skipped');
    expect(await t.db.query('select 1 from event_series')).toHaveLength(0);
  });

  it('records the import in the activity log', async () => {
    await seedEvents(t.db, SEED_DIR);
    const log = await t.db.query("select actor_id, action from activity_log where entity = 'seed'");
    expect(log).toEqual([{ actor_id: null, action: 'create' }]);
  });
});
