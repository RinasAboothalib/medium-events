import type { Db } from './db/index.js';
import { hashPassword } from './auth/passwords.js';
import { recordActivity } from './activity.js';

export const DEFAULT_ADMIN_EMAIL = 'admin@medium.mv';
export const DEFAULT_ADMIN_PASSWORD = 'Medium@2026!';

// Creates the default admin on an empty database. They must choose their own password at first sign-in.
export async function ensureDefaultAdmin(db: Db, password?: string): Promise<'created' | 'exists'> {
  return db.transaction(async (tx) => {
    const [{ count }] = await tx.query<{ count: number }>('select count(*)::int as count from users');
    if (count > 0) return 'exists';
    const [admin] = await tx.query<{ id: string }>(
      `insert into users (email, full_name, role, password_hash, must_change_password)
       values ($1, 'MEDIUM Admin', 'admin', $2, true) returning id`,
      [DEFAULT_ADMIN_EMAIL, await hashPassword(password || DEFAULT_ADMIN_PASSWORD)],
    );
    await recordActivity(tx, { actorId: null, entity: 'users', entityId: admin.id, action: 'create', changes: { email: DEFAULT_ADMIN_EMAIL, role: 'admin' }, at: new Date() });
    return 'created';
  });
}

// True while the default admin still hasn't chosen their own password
export async function defaultAdminPending(db: Db): Promise<boolean> {
  const rows = await db.query('select 1 from users where email = $1 and must_change_password and active', [DEFAULT_ADMIN_EMAIL]);
  return rows.length > 0;
}
