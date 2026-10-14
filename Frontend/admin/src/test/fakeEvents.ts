// Events, files and publishing for the in-memory test server (see fakeApi.ts).
import { can } from '../lib/permissions';
import type { Edition, Partner, PublishInfo, Series, StaffRole } from '../lib/types';

export const NOT_HANDLED = Symbol('not handled');

export interface EventsState {
  series: Series[];
  editions: Edition[];
  partners: Partner[];
  files: { id: string; filename: string; type: string }[];
  published: PublishInfo | null;
}

export function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: 's-cif',
    slug: 'construction-industry-forum',
    name: 'Construction Industry Forum',
    label: 'Construction Industry Forum',
    short_name: 'CIF',
    tagline: 'High-level dialogue.',
    description: ['First paragraph.'],
    website: 'https://cif.mv',
    endorsement: null,
    audience: 'Decision makers',
    usual_venue: 'Malé',
    usual_month: 'September',
    cta_secondary: null,
    sort_order: 1,
    active: true,
    edition_count: 0,
    ...overrides,
  };
}

export function makeEdition(overrides: Partial<Edition> = {}): Edition {
  return {
    id: 'e-cif-2025',
    series_id: 's-cif',
    series_name: 'Construction Industry Forum',
    name: 'Construction Industry Forum 2025',
    start_date: '2025-09-02',
    end_date: null,
    venue: 'JEN Malé',
    description: 'Decision makers met.',
    rsvp_count: 200,
    attendance: null,
    facebook_url: null,
    banner_file_id: null,
    status: 'past',
    outcome_notes: '',
    ...overrides,
  };
}

type Fail = (status: number, error: string, fields?: Record<string, string>) => never;

export function handleEvents(
  state: EventsState,
  role: StaffRole,
  method: string,
  route: string,
  query: URLSearchParams,
  body: Record<string, unknown> | undefined,
  fail: Fail,
  nextId: () => string,
): unknown {
  const [, area, id] = route.split('/');
  if (!['series', 'editions', 'partners', 'files', 'publish'].includes(area)) return NOT_HANDLED;
  if (method !== 'GET' && !can(role, area === 'publish' ? 'events.publish' : 'events.write')) fail(403, "You don't have access to this.");
  const count = (seriesId: string) => state.editions.filter((e) => e.series_id === seriesId).length;
  const withCount = (s: Series) => ({ ...s, edition_count: count(s.id) });

  if (area === 'series') {
    if (method === 'GET' && !id) return state.series.map(withCount);
    if (method === 'POST') {
      if (state.series.some((s) => s.slug === body!.slug)) fail(409, 'That web address is already used by another series.');
      const created = makeSeries({ ...(body as Partial<Series>), id: nextId() });
      state.series.push(created);
      return withCount(created);
    }
    const found = state.series.find((s) => s.id === id) ?? fail(404, 'That series was not found.');
    if (method === 'GET') return withCount(found);
    if (method === 'PATCH') return withCount(Object.assign(found, body));
    if (method === 'DELETE') {
      if (count(found.id)) fail(409, "Remove this series' editions first.");
      state.series = state.series.filter((s) => s !== found);
      return undefined;
    }
  }

  if (area === 'editions') {
    if (method === 'GET' && !id) {
      const seriesId = query.get('series_id');
      return state.editions.filter((e) => !seriesId || e.series_id === seriesId).sort((a, b) => b.start_date.localeCompare(a.start_date));
    }
    if (method === 'POST') {
      const series = state.series.find((s) => s.id === body!.series_id);
      const created = makeEdition({ ...(body as Partial<Edition>), id: nextId(), series_name: series?.name ?? '' });
      state.editions.push(created);
      return created;
    }
    const found = state.editions.find((e) => e.id === id) ?? fail(404, 'That edition was not found.');
    if (method === 'GET') return { ...found };
    if (method === 'PATCH') return { ...Object.assign(found, body) };
    if (method === 'DELETE') {
      state.editions = state.editions.filter((e) => e !== found);
      return undefined;
    }
  }

  if (area === 'partners') {
    if (method === 'GET') {
      return state.partners.filter(
        (p) => (!query.get('series_id') || p.series_id === query.get('series_id')) && (!query.get('edition_id') || p.edition_id === query.get('edition_id')),
      );
    }
    if (method === 'POST') {
      const created: Partner = { id: nextId(), role: '', series_id: null, edition_id: null, sort_order: 0, ...(body as Partial<Partner>), name: String(body!.name) };
      state.partners.push(created);
      return created;
    }
    const found = state.partners.find((p) => p.id === id) ?? fail(404, 'That partner was not found.');
    if (method === 'PATCH') return Object.assign(found, body);
    if (method === 'DELETE') {
      state.partners = state.partners.filter((p) => p !== found);
      return undefined;
    }
  }

  if (area === 'files' && method === 'POST') {
    const file = { id: nextId(), filename: query.get('filename') ?? 'image', type: String(body?.type ?? 'image/jpeg') };
    state.files.push(file);
    return { id: file.id, filename: file.filename, content_type: file.type, size: 1 };
  }

  if (area === 'publish') {
    if (method === 'GET' && id === 'latest') return state.published;
    if (method === 'POST') {
      const series = state.series.filter((s) => s.active);
      const events = state.editions.filter((e) => e.status === 'past' && series.some((s) => s.id === e.series_id));
      state.published = { published_at: '2026-10-13T05:00:00.000Z', published_by_name: 'You', series: series.length, events: events.length };
      return { published_at: state.published.published_at, series: series.length, events: events.length, deploy_hook: 'not_configured' };
    }
  }
  return NOT_HANDLED;
}
