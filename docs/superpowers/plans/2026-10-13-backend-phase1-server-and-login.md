# Backend Phase 1 — Server, Login, Staff, Activity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Node/Express server with its own accounts and sessions (default admin `admin@medium.mv`), storing data in Postgres (PGlite locally, Supabase via `DATABASE_URL`), with the admin app's sign-in, password change, Staff and Activity pages running on it.

**Architecture:** `server/` is a separate package. `createApp({ db, clock })` builds the Express app so tests run it in-process against in-memory PGlite. Migrations are SQL files applied at startup. Permissions live in one module used by route guards and tests. The admin app replaces its Supabase client with a small `api` fetch wrapper; Vite proxies `/api` to the server in development.

**Tech Stack:** Node 22, Express 4, TypeScript, tsx, @electric-sql/pglite, pg, bcryptjs, zod, Vitest, supertest; admin: Vite 8, React 19, react-router 7.

**Spec:** `docs/superpowers/specs/2026-10-13-admin-backend-design.md` (§1–6, §9 Staff/Activity/My account, §10–11). Branch `feat/admin-foundation`. Paths relative to `Medium--main/`.

## Global Constraints

- Roles `admin`, `sales`, `events`, `finance`. Default admin `admin@medium.mv`, password `DEFAULT_ADMIN_PASSWORD` or `Medium@2026!`, `must_change_password = true`, created only when `users` is empty.
- Passwords: bcrypt cost 12; minimum 10 characters; never logged or returned.
- Session cookie `medium_session`: random 32 bytes base64url, stored as sha-256; `HttpOnly`, `SameSite=Lax`, `Secure` when `NODE_ENV=production`; 8 h idle, 30 days absolute.
- Login failure message always "Email or password is incorrect."; lockout after 5 failures per email in 15 minutes: "Too many attempts. Try again in 15 minutes."
- While `must_change_password`, all routes except `GET /api/auth/me`, `POST /api/auth/logout`, `POST /api/auth/change-password` return 403 `{ error: 'password_change_required' }`.
- Nobody changes own role/active or resets own password via staff routes; never zero active admins (transaction + `pg_advisory_xact_lock`).
- Every write and every login writes `activity_log` in the same transaction.
- Every table gets `alter table … enable row level security` (no policies).
- No Supabase client libraries, keys or emails anywhere after this phase.

## Review Focus

1. **Login timing and enumeration** — unknown email, wrong password and inactive user must return the same message and status — test in Task 2.
2. **Two admins demoting each other concurrently** — at least one active admin remains — test in Task 3.
3. **Session after deactivation or password change** — other sessions stop working immediately — test in Tasks 2–3.
4. **Email case and whitespace** (`" Admin@Medium.MV "`) — logs in and can't be duplicated — test in Tasks 2–3.
5. **Server restarted against an existing database** — migrations not re-applied, default admin not recreated — test in Task 1/2.

---

### Task 0: Server package and database layer

**Files:** `server/package.json`, `server/tsconfig.json`, `server/vitest.config.ts`, `server/.env.example`, `server/src/db/index.ts`, `server/src/db/migrate.ts`, `server/src/app.ts`, `server/src/index.ts`, `server/src/db/db.test.ts`; root `.gitignore` adds `server/.data/`, `server/.env`, `server/dist/`.

**Produces:** `type Db = { query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>; transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>; close(): Promise<void> }`; `openDb({ url?: string; dataDir?: string | 'memory' }): Promise<Db>`; `migrate(db, dir): Promise<string[]>` (returns newly applied names); `createApp({ db, now?: () => Date }): express.Express`; `GET /api/health` → `{ ok: true }`.

- [ ] Failing tests: in-memory db runs `select 1`; `transaction` rolls back on throw; `migrate` applies files in name order once (second call returns `[]`); `GET /api/health` 200.
- [ ] Implement (scripts: `dev` = `tsx watch src/index.ts`, `build` = `tsc`, `start` = `node dist/index.js`, `test`, `lint`). `index.ts` reads `server/.env` (dotenv), opens db, migrates, bootstraps default admin (Task 2), listens on `PORT` (3020).
- [ ] Tests, lint pass. Commit `chore: server package and database layer`.

### Task 1: Schema and permissions

**Files:** `server/migrations/001_accounts.sql`, `server/src/permissions.ts`, `server/src/permissions.test.ts`.

**Produces:** tables `users`, `sessions`, `activity_log` (spec §3) with RLS enabled; `type Role`; `PERMISSIONS: Record<Permission, Role[]>` covering every row of spec §5 (names like `staff.write`, `activity.readAll`, `events.write`, `deals.readAmounts`, `payments.write`, `reports.postEvent` …); `can(role, permission): boolean`.

- [ ] Failing tests: `can` matches spec §5 for every permission and role (table-driven, literal expectations); migration creates the three tables; `pg_class.relrowsecurity` true for each.
- [ ] Implement. Tests pass. Commit `feat: accounts schema and permission matrix`.

### Task 2: Authentication and default admin

**Files:** `server/src/auth/passwords.ts`, `server/src/auth/sessions.ts`, `server/src/auth/routes.ts`, `server/src/auth/middleware.ts`, `server/src/auth/lockout.ts`, `server/src/bootstrap.ts`, `server/src/activity.ts`, `server/src/auth/auth.test.ts`.

**Produces:** `hashPassword`, `verifyPassword`; `createSession(db, userId, now) → token`; `requireAuth` (sets `req.user`), `requirePermission(p)`; `recordActivity(tx, { actorId, entity, entityId, action, changes })`; `ensureDefaultAdmin(db, password?) → 'created' | 'exists'`; routes in spec §4.

- [ ] Failing tests: default admin created once (second call `'exists'`, still one user); login as default admin → cookie set, `me` shows `must_change_password: true`; any other route → 403 `password_change_required`; change-password (wrong current → 400; < 10 chars → 400; same as current → 400; success clears flag and other sessions die); unknown email / wrong password / inactive user → identical 401 body; email `" Admin@Medium.MV "` logs in; 6th failed attempt within 15 min → 429 lockout message, unlocks after 15 min (injected clock); idle 8 h → 401; logout kills session; login writes `activity_log` `login`.
- [ ] Implement. Tests pass. Commit `feat: server sign-in, sessions and default admin`.

### Task 3: Staff

**Files:** `server/src/staff/routes.ts`, `server/src/staff/staff.test.ts`.

**Produces:** `GET /api/staff` (admin: all fields except hash; others: id, full_name, role, active), `POST /api/staff {email, full_name, role, temp_password}`, `PATCH /api/staff/:id {full_name?, role?, active?}`, `POST /api/staff/:id/reset-password {temp_password}`.

- [ ] Failing tests: non-admin write → 403 for each route; create → 201, `must_change_password` true, duplicate email (any case) → 409 "That email already has an account."; own role/active change → 400; own reset → 400; demoting/deactivating the last active admin → 409 "There must always be at least one active admin."; two concurrent demotions leave ≥ 1 active admin; deactivation deletes that user's sessions; reset sets flag and kills sessions; every write logs activity with changed fields only.
- [ ] Implement. Tests pass. Commit `feat: staff management API`.

### Task 4: Activity log

**Files:** `server/src/activity/routes.ts`, `server/src/activity/activity.test.ts`.

**Produces:** `GET /api/activity?actor&entity&action&from&to&page` → `{ rows, total }`, 50/page, newest first, `from/to` as Maldives dates (`+05:00`), non-admins forced to `actor = self`.

- [ ] Failing tests: admin sees all; finance sees only own even with `actor=<other>`; filters and paging; `actor_name` included.
- [ ] Implement. Tests pass. Commit `feat: activity log API`.

### Task 5: Admin app on the new server

**Files:** create `admin/src/lib/api.ts`, `admin/src/test/fakeApi.ts`; rewrite `admin/src/lib/auth.tsx`, `staff.ts`, `activity.ts`, `pages/LoginPage.tsx`, `pages/ChangePasswordPage.tsx` (adds "Current password"), `pages/StaffPage.tsx` (uses API), `pages/ActivityPage.tsx`; add `pages/AccountPage.tsx` (change password any time, `/account`); `vite.config.ts` proxy `/api → http://localhost:3020`; delete `lib/supabase.ts`, `test/fakeSupabase.ts`, `admin/.env` Supabase keys, `@supabase/supabase-js` dependency; port all admin tests to `fakeApi`.

**Produces:** `api.get/post/patch/del<T>(path, body?)` throwing `ApiError { status, message, code }`; on 401 → auth cleared; on `password_change_required` → navigate `/change-password`.

- [ ] Port tests first (they fail on missing `api`): sign-in errors, forced change (now with current password), deactivated-mid-session, role refresh on navigation, layout per role, staff create/reset/role/deactivate/last-admin message, activity filters and paging, account page.
- [ ] Implement. `npm --prefix admin test`, `lint`, `build` pass. Commit `feat: admin app on the MEDIUM server`.

### Task 6: Remove the superseded Supabase setup

- [ ] Delete `supabase/` (migrations, functions, tests, seed, config), `scripts/create-default-admin.mjs`, `scripts/supabase-env.mjs`; remove root devDependencies `supabase`, `@supabase/supabase-js` and the `test:db` script; root `.gitignore` keeps `supabase/.env.local` ignored (file may still exist locally with the user's notes — do not delete the user's local file).
- [ ] `.claude/launch.json` gains `medium-server` (port 3020); `medium-admin` unchanged.
- [ ] README "Admin backend" section: run server + admin, default login, `DATABASE_URL` for Supabase, data folder, backup note.
- [ ] Site, server and admin test suites green. Commit `chore: remove Supabase auth setup; document the admin backend`.

### Task 7: End-to-end check

- [ ] Start server (local PGlite) and admin; in the browser: sign in `admin@medium.mv` / default password → forced change → dashboard; create a Sales user with a temporary password; sign out; sign in as that user → forced change → Sales navigation; admin deactivates them → their next action signs them out; activity log shows all of it. 1280px and 375px, no console errors.
- [ ] Restart the server: data kept, default admin not recreated, warning gone once password changed.
