import { ApiError, api } from './api';
import type { ActivityRow } from './types';

// Matches server/src/activity/routes.ts
export const PAGE_SIZE = 50;

export interface ActivityFilters {
  actorId?: string;
  action?: string;
  from?: string; // YYYY-MM-DD, a Maldives calendar day
  to?: string; // YYYY-MM-DD, inclusive
  page: number; // 0-based
}

export async function listActivity(f: ActivityFilters): Promise<{ rows: ActivityRow[]; total: number }> {
  const params = new URLSearchParams();
  if (f.actorId) params.set('actor', f.actorId);
  if (f.action) params.set('action', f.action);
  if (f.from) params.set('from', f.from);
  if (f.to) params.set('to', f.to);
  params.set('page', String(f.page));
  try {
    return await api.get(`/activity?${params}`);
  } catch (e) {
    throw new Error(e instanceof ApiError && e.status !== 0 ? e.message : "The activity log couldn't be loaded. Refresh to try again.");
  }
}

const ENTITY_LABELS: Record<string, string> = { users: 'Staff', session: 'Sign-in', programme_sessions: 'Programme sessions' };
export const ACTION_LABELS: Record<ActivityRow['action'], string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  login: 'Signed in',
  publish: 'Published',
  export: 'Exported',
};

export const entityLabel = (entity: string) => ENTITY_LABELS[entity] ?? entity;
export const actionLabel = (action: string) => ACTION_LABELS[action as ActivityRow['action']] ?? action;

export { formatWhen } from './dates';

const isChange = (value: unknown): value is { old: unknown; new: unknown } =>
  typeof value === 'object' && value !== null && 'old' in value && 'new' in value;

// Readable summary of an update: field: "old" → "new" for changed fields, field: value for notes like { password: 'changed' }
export function summariseChanges(row: ActivityRow): string {
  if (row.action !== 'update') return '';
  return Object.entries(row.changes)
    .map(([field, value]) => (isChange(value) ? `${field}: ${JSON.stringify(value.old)} → ${JSON.stringify(value.new)}` : `${field}: ${value}`))
    .join('; ');
}
