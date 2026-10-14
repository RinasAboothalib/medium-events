import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Db } from './index.js';

// Applies every *.sql file in `dir` that hasn't run yet, in name order, each in its own transaction.
export async function migrate(db: Db, dir: string): Promise<string[]> {
  await db.exec('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())');
  const done = new Set((await db.query<{ name: string }>('select name from schema_migrations')).map((r) => r.name));
  const pending = readdirSync(dir)
    .filter((f) => f.endsWith('.sql') && !done.has(f))
    .sort();

  for (const name of pending) {
    await db.transaction(async (tx) => {
      await tx.exec(readFileSync(join(dir, name), 'utf8'));
      await tx.query('insert into schema_migrations (name) values ($1)', [name]);
    });
  }
  return pending;
}
