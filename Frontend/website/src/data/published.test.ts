import { describe, expect, it } from 'vitest';
import { choosePublished, type SiteSnapshot } from './published';
import type { EventSeries, PastEvent } from '../types';

const builtIn = {
  series: [{ slug: 'built-in' } as EventSeries],
  events: [{ id: 'built-in-event' } as PastEvent],
  partners: [{ name: 'Built-in partner', role: 'x' }],
};

const snapshot: SiteSnapshot = {
  published_at: '2026-10-13T05:00:00.000Z',
  series: [{ slug: 'published' } as EventSeries],
  events: [],
  upcoming: [],
  partners: [{ name: 'SITA', role: 'Sponsor' }],
};

describe('choosePublished', () => {
  it('uses the built-in data when nothing has been published', () => {
    expect(choosePublished(null, builtIn)).toBe(builtIn);
  });

  it('uses published data, even when a list is empty', () => {
    expect(choosePublished(snapshot, builtIn)).toEqual({ series: snapshot.series, events: [], partners: snapshot.partners });
  });
});
