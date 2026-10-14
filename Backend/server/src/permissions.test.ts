import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PERMISSIONS, can, type Permission, type Role } from './permissions.js';
import { openDb } from './db/index.js';
import { migrate } from './db/migrate.js';

// Spec §5, written out literally so a change to the matrix must be deliberate
const EXPECTED: Record<Permission, Role[]> = {
  'staff.list': ['admin', 'sales', 'events', 'finance'],
  'staff.details': ['admin'],
  'staff.write': ['admin'],
  'activity.readOwn': ['admin', 'sales', 'events', 'finance'],
  'activity.readAll': ['admin'],
  'events.read': ['admin', 'sales', 'events', 'finance'],
  'events.write': ['admin', 'events'],
  'events.publish': ['admin', 'events'],
  'tasks.read': ['admin', 'sales', 'events', 'finance'],
  'tasks.write': ['admin', 'events'],
  'delegates.read': ['admin', 'events', 'sales'],
  'delegates.write': ['admin', 'events'],
  'enquiries.access': ['admin', 'sales'],
  'sponsors.read': ['admin', 'sales', 'events', 'finance'],
  'sponsors.write': ['admin', 'sales'],
  'deals.read': ['admin', 'sales', 'events', 'finance'],
  'deals.readAmounts': ['admin', 'sales', 'finance'],
  'deals.write': ['admin', 'sales'],
  'payments.read': ['admin', 'sales', 'finance'],
  'payments.write': ['admin', 'finance'],
  'payments.delete': ['admin'],
  'expenses.read': ['admin', 'finance'],
  'expenses.write': ['admin', 'finance'],
  'reports.postEvent': ['admin', 'events'],
  'reports.sponsorship': ['admin', 'sales', 'finance'],
  'reports.enquiries': ['admin', 'sales'],
  'reports.delegates': ['admin', 'events'],
  'reports.budget': ['admin', 'finance'],
};

const ROLES: Role[] = ['admin', 'sales', 'events', 'finance'];

describe('permission matrix', () => {
  it('lists exactly the permissions in the spec', () => {
    expect(Object.keys(PERMISSIONS).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it.each(Object.entries(EXPECTED))('%s', (permission, allowed) => {
    for (const role of ROLES) expect(can(role, permission as Permission), `${role} ${permission}`).toBe(allowed.includes(role));
  });

  it('never lets events see amounts or payments', () => {
    expect(can('events', 'deals.readAmounts')).toBe(false);
    expect(can('events', 'payments.read')).toBe(false);
    expect(can('events', 'expenses.read')).toBe(false);
    expect(can('events', 'reports.budget')).toBe(false);
  });
});

describe('accounts schema', () => {
  it('creates users, sessions and activity_log with row-level security on', async () => {
    const db = await openDb({ dataDir: 'memory' });
    await migrate(db, join(__dirname, '..', 'migrations'));
    const rows = await db.query<{ relname: string; relrowsecurity: boolean }>(
      "select relname, relrowsecurity from pg_class where relname in ('users', 'sessions', 'activity_log') order by relname",
    );
    expect(rows).toEqual([
      { relname: 'activity_log', relrowsecurity: true },
      { relname: 'sessions', relrowsecurity: true },
      { relname: 'users', relrowsecurity: true },
    ]);
    await db.close();
  });
});
