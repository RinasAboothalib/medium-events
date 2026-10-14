// One small interface over two Postgres engines:
//  - PGlite (embedded Postgres) for local development and tests: no setup, data in Backend/server/.data
//  - node-postgres for Supabase (or any Postgres) when DATABASE_URL is set
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  // Runs several SQL statements (migrations); no parameters
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export async function openDb(opts: { url?: string; dataDir?: string | 'memory' }): Promise<Db> {
  return opts.url ? openPg(opts.url) : openPglite(opts.dataDir ?? 'memory');
}

type PgliteLike = Pick<PGlite, 'query' | 'exec'>;

function wrapPglite(conn: PgliteLike, root: PGlite): Db {
  return {
    async query<T>(sql: string, params: unknown[] = []) {
      return (await conn.query<T>(sql, params)).rows;
    },
    async exec(sql: string) {
      await conn.exec(sql);
    },
    // Nested transactions run inside the outer one
    transaction: (fn) => (conn === root ? root.transaction((tx) => fn(wrapPglite(tx, root))) : fn(wrapPglite(conn, root))),
    close: () => root.close(),
  };
}

async function openPglite(dataDir: string): Promise<Db> {
  const db = dataDir === 'memory' ? new PGlite() : new PGlite(dataDir);
  await db.waitReady;
  return wrapPglite(db, db);
}

// Connection settings for a DATABASE_URL. Hosted Postgres (Supabase and most others) needs SSL, but its
// certificate chain isn't in Node's trust store, so the connection is encrypted without verifying it.
// SSL is off for a database on this machine, or when the URL (or PGSSLMODE) says sslmode=disable,
// e.g. a host's internal Postgres that doesn't offer SSL.
// sslmode is removed from the URL because node-postgres would otherwise override these settings
// (it reads sslmode=require as "verify the certificate", which fails against Supabase).
export function pgConnection(url: string): { connectionString: string; ssl: false | { rejectUnauthorized: false } } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // Not a URL node can parse (e.g. a password with an unencoded @): pass it through unchanged
    return { connectionString: url, ssl: { rejectUnauthorized: false } };
  }
  const mode = (parsed.searchParams.get('sslmode') ?? process.env.PGSSLMODE ?? '').toLowerCase();
  for (const key of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'uselibpqcompat']) parsed.searchParams.delete(key);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  const ssl = mode === 'disable' || (local && !mode) ? false : { rejectUnauthorized: false as const };
  return { connectionString: parsed.toString(), ssl };
}

async function openPg(url: string): Promise<Db> {
  const pool = new pg.Pool({ ...pgConnection(url), max: 10 });
  // Postgres bigint and numeric arrive as strings by default; keep numeric precise (string) but parse counts
  pg.types.setTypeParser(20, (v) => Number(v));

  const wrapClient = (client: pg.PoolClient): Db => ({
    query: async <T>(sql: string, params: unknown[] = []) => (await client.query(sql, params)).rows as T[],
    exec: async (sql) => {
      await client.query(sql);
    },
    transaction: (fn) => fn(wrapClient(client)),
    close: async () => undefined,
  });

  return {
    query: async <T>(sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows as T[],
    exec: async (sql) => {
      await pool.query(sql);
    },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const result = await fn(wrapClient(client));
        await client.query('commit');
        return result;
      } catch (e) {
        await client.query('rollback');
        throw e;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}
