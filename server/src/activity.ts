import type { Db } from './db/index.js';

export type ActivityAction = 'create' | 'update' | 'delete' | 'login' | 'publish' | 'export';

// Called inside the same transaction as the change it describes, so the log can't drift from the data
export async function recordActivity(
  tx: Db,
  entry: { actorId: string | null; entity: string; entityId: string; action: ActivityAction; changes?: Record<string, unknown>; at: Date },
) {
  await tx.query('insert into activity_log (at, actor_id, entity, entity_id, action, changes) values ($1, $2, $3, $4, $5, $6)', [
    entry.at,
    entry.actorId,
    entry.entity,
    entry.entityId,
    entry.action,
    JSON.stringify(entry.changes ?? {}),
  ]);
}

// { field: { old, new } } for the fields that actually changed (lists and objects compared by value)
const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

export function diff<T extends Record<string, unknown>>(before: T, patch: Partial<T>) {
  const changes: Record<string, { old: unknown; new: unknown }> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined && !same(before[key], value)) changes[key] = { old: before[key], new: value };
  }
  return changes;
}
