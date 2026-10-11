// Every signed-in API route × every role: 403 exactly when permissions.ts says no.
// Any other status (200, 400, 404, …) means the request got past the permission check.
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { ROLE_LIST, setup, signedInAsEveryRole } from './test/helpers.js';
import { can, type Permission } from './permissions.js';

const ID = '00000000-0000-0000-0000-000000000000';

const ROUTES: [method: 'get' | 'post' | 'patch' | 'delete', path: string, permission: Permission | null][] = [
  ['get', '/api/dashboard', null],
  ['get', '/api/staff', 'staff.list'],
  ['post', '/api/staff', 'staff.write'],
  ['patch', `/api/staff/${ID}`, 'staff.write'],
  ['post', `/api/staff/${ID}/reset-password`, 'staff.write'],
  ['get', '/api/activity', 'activity.readOwn'],
  ['get', '/api/series', 'events.read'],
  ['get', `/api/series/${ID}`, 'events.read'],
  ['post', '/api/series', 'events.write'],
  ['patch', `/api/series/${ID}`, 'events.write'],
  ['delete', `/api/series/${ID}`, 'events.write'],
  ['get', '/api/editions', 'events.read'],
  ['get', `/api/editions/${ID}`, 'events.read'],
  ['post', '/api/editions', 'events.write'],
  ['patch', `/api/editions/${ID}`, 'events.write'],
  ['delete', `/api/editions/${ID}`, 'events.write'],
  ['get', '/api/partners', 'events.read'],
  ['post', '/api/partners', 'events.write'],
  ['patch', `/api/partners/${ID}`, 'events.write'],
  ['delete', `/api/partners/${ID}`, 'events.write'],
  ['post', '/api/files', 'events.write'],
  ['get', `/api/files/${ID}`, 'events.read'],
  ['delete', `/api/files/${ID}`, 'events.write'],
  ['get', '/api/publish/latest', 'events.read'],
  ['post', '/api/publish', 'events.publish'],
  ['get', '/api/enquiries', 'enquiries.access'],
  ['post', '/api/enquiries', 'enquiries.access'],
  ['get', `/api/enquiries/${ID}`, 'enquiries.access'],
  ['patch', `/api/enquiries/${ID}`, 'enquiries.access'],
  ['post', `/api/enquiries/${ID}/notes`, 'enquiries.access'],
  ['get', '/api/sponsors', 'sponsors.read'],
  ['get', `/api/sponsors/${ID}`, 'sponsors.read'],
  ['post', '/api/sponsors', 'sponsors.write'],
  ['patch', `/api/sponsors/${ID}`, 'sponsors.write'],
  ['get', '/api/deals', 'deals.read'],
  ['get', `/api/deals/${ID}`, 'deals.read'],
  ['post', '/api/deals', 'deals.write'],
  ['patch', `/api/deals/${ID}`, 'deals.write'],
  ['get', `/api/deals/${ID}/payments`, 'payments.read'],
  ['post', `/api/deals/${ID}/payments`, 'payments.write'],
  ['delete', `/api/payments/${ID}`, 'payments.delete'],
  ['get', `/api/reports/post-event/${ID}.pdf`, 'reports.postEvent'],
  ['get', '/api/reports/sponsorship.xlsx', 'reports.sponsorship'],
  ['get', '/api/reports/sponsorship.pdf', 'reports.sponsorship'],
  ['get', '/api/reports/enquiries.xlsx', 'reports.enquiries'],
  ['get', '/api/reports/delegates.xlsx', 'reports.delegates'],
  ['get', '/api/reports/budget.xlsx', 'reports.budget'],
  ['get', '/api/tasks', 'tasks.read'],
  ['get', `/api/tasks/${ID}`, 'tasks.read'],
  ['post', '/api/tasks', 'tasks.write'],
  ['patch', `/api/tasks/${ID}`, 'tasks.write'],
  ['delete', `/api/tasks/${ID}`, 'tasks.write'],
  ['get', '/api/speakers', 'events.read'],
  ['post', '/api/speakers', 'events.write'],
  ['patch', `/api/speakers/${ID}`, 'events.write'],
  ['delete', `/api/speakers/${ID}`, 'events.write'],
  ['get', '/api/sessions', 'events.read'],
  ['post', '/api/sessions', 'events.write'],
  ['patch', `/api/sessions/${ID}`, 'events.write'],
  ['delete', `/api/sessions/${ID}`, 'events.write'],
  ['get', '/api/delegates', 'delegates.read'],
  ['get', `/api/delegates/${ID}`, 'delegates.read'],
  ['post', '/api/delegates', 'delegates.write'],
  ['patch', `/api/delegates/${ID}`, 'delegates.write'],
  ['delete', `/api/delegates/${ID}`, 'delegates.write'],
  ['post', `/api/delegates/${ID}/check-in`, 'delegates.write'],
  ['delete', `/api/delegates/${ID}/check-in`, 'delegates.write'],
  ['get', '/api/expenses', 'expenses.read'],
  ['get', '/api/expenses/summary', 'expenses.read'],
  ['get', `/api/expenses/${ID}`, 'expenses.read'],
  ['post', '/api/expenses', 'expenses.write'],
  ['patch', `/api/expenses/${ID}`, 'expenses.write'],
  ['delete', `/api/expenses/${ID}`, 'expenses.write'],
];

let t: Awaited<ReturnType<typeof setup>>;
let s: Awaited<ReturnType<typeof signedInAsEveryRole>>;

beforeAll(async () => {
  t = await setup();
  s = await signedInAsEveryRole(t);
});

describe('permission matrix', () => {
  for (const [method, path, permission] of ROUTES) {
    it(`${method.toUpperCase()} ${path}`, async () => {
      for (const role of ROLE_LIST) {
        const res = await s.as[role][method](path).send({});
        const allowed = permission === null || can(role, permission);
        expect({ role, forbidden: res.status === 403 }).toEqual({ role, forbidden: !allowed });
      }
      expect((await request(t.app)[method](path)).status).toBe(401);
    });
  }
});
