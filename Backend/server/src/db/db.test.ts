import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { openDb, pgConnection } from './index.js';
import { migrate } from './migrate.js';
import { createApp } from '../app.js';

describe('database layer', () => {
  it('runs queries on an in-memory database', async () => {
    const db = await openDb({ dataDir: 'memory' });
    expect(await db.query<{ n: number }>('select 1 as n')).toEqual([{ n: 1 }]);
    await db.close();
  });

  it('rolls back a failed transaction', async () => {
    const db = await openDb({ dataDir: 'memory' });
    await db.query('create table t (v int)');
    await expect(
      db.transaction(async (tx) => {
        await tx.query('insert into t values (1)');
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await db.query('select * from t')).toEqual([]);
    await db.close();
  });

  it('applies migrations in name order, once', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mig-'));
    writeFileSync(join(dir, '002_b.sql'), 'insert into t values (2);');
    writeFileSync(join(dir, '001_a.sql'), 'create table t (v int); insert into t values (1);');
    const db = await openDb({ dataDir: 'memory' });
    expect(await migrate(db, dir)).toEqual(['001_a.sql', '002_b.sql']);
    expect(await migrate(db, dir)).toEqual([]);
    expect(await db.query('select v from t order by v')).toEqual([{ v: 1 }, { v: 2 }]);
    await db.close();
  });
});

describe('app', () => {
  it('answers the health check', async () => {
    const db = await openDb({ dataDir: 'memory' });
    const res = await request(createApp({ db })).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    await db.close();
  });
});

describe('DATABASE_URL connection settings', () => {
  it('uses SSL without certificate checks for hosted databases, even when the URL says sslmode=require', () => {
    expect(pgConnection('postgresql://postgres.ref:pw@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require')).toEqual({
      connectionString: 'postgresql://postgres.ref:pw@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
      ssl: { rejectUnauthorized: false },
    });
  });

  it('turns SSL off for a database on this machine or when the URL asks for it', () => {
    expect(pgConnection('postgres://u:p@localhost:5432/db').ssl).toBe(false);
    expect(pgConnection('postgres://u:p@internal-db:5432/db?sslmode=disable')).toEqual({ connectionString: 'postgres://u:p@internal-db:5432/db', ssl: false });
  });
});
