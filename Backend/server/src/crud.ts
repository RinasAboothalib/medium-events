// Small SQL helpers shared by the module routers. Table and column names always come from code, never from requests.
import type { Db } from './db/index.js';

// Inserts the defined keys of `values` and returns the new row's id
export async function insertRow(tx: Db, table: string, values: Record<string, unknown>): Promise<string> {
  const entries = Object.entries(values).filter(([, v]) => v !== undefined);
  const columns = entries.map(([k]) => k).join(', ');
  const placeholders = entries.map((_, i) => `$${i + 1}`).join(', ');
  const [row] = await tx.query<{ id: string }>(`insert into ${table} (${columns}) values (${placeholders}) returning id::text`, entries.map(([, v]) => v));
  return row.id;
}

// Updates the defined keys of `patch` on one row; does nothing when the patch is empty
export async function updateRow(tx: Db, table: string, id: string, patch: Record<string, unknown>): Promise<void> {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
  if (!entries.length) return;
  const sets = entries.map(([k], i) => `${k} = $${i + 2}`).join(', ');
  await tx.query(`update ${table} set ${sets} where id = $1`, [id, ...entries.map(([, v]) => v)]);
}

// `?page=` as a non-negative integer
export const pageOf = (value: unknown) => Math.max(0, Math.floor(Number(value) || 0));
