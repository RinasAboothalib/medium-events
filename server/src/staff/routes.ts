import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../app.js';
import type { Db } from '../db/index.js';
import { diff, recordActivity } from '../activity.js';
import { currentUser, requirePermission } from '../auth/middleware.js';
import { MIN_PASSWORD_LENGTH, hashPassword } from '../auth/passwords.js';
import { deleteUserSessions } from '../auth/sessions.js';
import { HttpError, route, validationError } from '../http.js';
import { ROLES, can } from '../permissions.js';

const LAST_ADMIN = 'There must always be at least one active admin.';
const role = z.enum(ROLES as [string, ...string[]], { message: 'Choose a role.' });
const tempPassword = z.string().min(MIN_PASSWORD_LENGTH, `The temporary password needs at least ${MIN_PASSWORD_LENGTH} characters.`);

const createBody = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  full_name: z.string().trim().min(1, "Enter the person's name."),
  role,
  temp_password: tempPassword,
});
const patchBody = z.object({
  full_name: z.string().trim().min(1, "Enter the person's name.").optional(),
  role: role.optional(),
  active: z.boolean().optional(),
});

const ADMIN_FIELDS = 'id, email, full_name, role, active, must_change_password, last_login_at, created_at';

// Fails unless some active admin other than `excludingId` exists. The advisory lock makes concurrent
// demotions run one after another, so two admins can't remove each other at the same moment.
export async function assertAdminRemains(tx: Db, excludingId: string) {
  await tx.query("select pg_advisory_xact_lock(hashtext('medium_last_admin'))");
  const [{ n }] = await tx.query<{ n: number }>("select count(*)::int as n from users where role = 'admin' and active and id <> $1", [excludingId]);
  if (n === 0) throw new HttpError(409, LAST_ADMIN);
}

// The acting admin may have been demoted or deactivated by someone else since the request started
async function assertStillAdmin(tx: Db, actorId: string) {
  const [actor] = await tx.query<{ role: string; active: boolean }>('select role, active from users where id = $1', [actorId]);
  if (!actor?.active || actor.role !== 'admin') throw new HttpError(403, "You don't have access to this.");
}

export function staffRoutes(ctx: AppContext) {
  const router = Router();

  router.get(
    '/',
    requirePermission('staff.list'),
    route(async (_req, res) => {
      const details = can(currentUser(res).role, 'staff.details');
      const rows = await ctx.db.query(
        details ? `select ${ADMIN_FIELDS} from users order by full_name` : 'select id, full_name, role, active from users order by full_name',
      );
      res.json(rows);
    }),
  );

  router.post(
    '/',
    requirePermission('staff.write'),
    route(async (req, res) => {
      const parsed = createBody.safeParse(req.body);
      if (!parsed.success) throw validationError(parsed.error);
      const { email, full_name, role, temp_password } = parsed.data;
      const actor = currentUser(res);
      const now = ctx.now();

      const user = await ctx.db.transaction(async (tx) => {
        await assertStillAdmin(tx, actor.id);
        const existing = await tx.query('select 1 from users where email = $1', [email]);
        if (existing.length) throw new HttpError(409, 'That email already has an account.');
        const [created] = await tx.query<{ id: string }>(
          `insert into users (email, full_name, role, password_hash, must_change_password, created_at)
           values ($1, $2, $3, $4, true, $5) returning ${ADMIN_FIELDS}`,
          [email, full_name, role, await hashPassword(temp_password), now],
        );
        await recordActivity(tx, { actorId: actor.id, entity: 'users', entityId: created.id, action: 'create', changes: { email, full_name, role }, at: now });
        return created;
      });
      res.status(201).json(user);
    }),
  );

  router.patch(
    '/:id',
    requirePermission('staff.write'),
    route(async (req, res) => {
      const parsed = patchBody.safeParse(req.body);
      if (!parsed.success) throw validationError(parsed.error);
      const patch = parsed.data;
      const actor = currentUser(res);
      const targetId = req.params.id;
      if (targetId === actor.id && (patch.role !== undefined || patch.active !== undefined)) {
        throw new HttpError(400, "You can't change your own role or access.");
      }
      const now = ctx.now();

      const updated = await ctx.db.transaction(async (tx) => {
        await assertStillAdmin(tx, actor.id);
        const [before] = await tx.query<{ id: string; full_name: string; role: string; active: boolean }>(
          'select id, full_name, role, active from users where id = $1 for update',
          [targetId],
        );
        if (!before) throw new HttpError(404, 'That person was not found.');

        const losesAdmin = before.role === 'admin' && before.active && ((patch.role && patch.role !== 'admin') || patch.active === false);
        if (losesAdmin) await assertAdminRemains(tx, targetId);

        const changes = diff(before, patch);
        if (Object.keys(changes).length === 0) return (await tx.query(`select ${ADMIN_FIELDS} from users where id = $1`, [targetId]))[0];

        const [row] = await tx.query(
          `update users set full_name = coalesce($2, full_name), role = coalesce($3, role), active = coalesce($4, active), updated_at = $5
            where id = $1 returning ${ADMIN_FIELDS}`,
          [targetId, patch.full_name ?? null, patch.role ?? null, patch.active ?? null, now],
        );
        if (patch.active === false) await deleteUserSessions(tx, targetId);
        await recordActivity(tx, { actorId: actor.id, entity: 'users', entityId: targetId, action: 'update', changes, at: now });
        return row;
      });
      res.json(updated);
    }),
  );

  router.post(
    '/:id/reset-password',
    requirePermission('staff.write'),
    route(async (req, res) => {
      const parsed = z.object({ temp_password: tempPassword }).safeParse(req.body);
      if (!parsed.success) throw validationError(parsed.error);
      const actor = currentUser(res);
      const targetId = req.params.id;
      if (targetId === actor.id) throw new HttpError(400, 'Change your own password from My account.');
      const now = ctx.now();

      await ctx.db.transaction(async (tx) => {
        await assertStillAdmin(tx, actor.id);
        const rows = await tx.query(
          'update users set password_hash = $2, must_change_password = true, updated_at = $3 where id = $1 returning id',
          [targetId, await hashPassword(parsed.data.temp_password), now],
        );
        if (!rows.length) throw new HttpError(404, 'That person was not found.');
        await deleteUserSessions(tx, targetId);
        await recordActivity(tx, { actorId: actor.id, entity: 'users', entityId: targetId, action: 'update', changes: { password: 'reset' }, at: now });
      });
      res.status(204).end();
    }),
  );

  return router;
}
