# Admin Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Supabase-backed admin app where MEDIUM staff sign in with one of four roles, admins invite and manage staff, and every change is recorded in a tamper-proof activity log.

**Architecture:** Versioned SQL migrations in `supabase/` define the schema, role helpers, RLS and audit triggers; a Deno Edge Function holds the service key for invitations; a separate static Vite/React app in `admin/` talks to Supabase with the anon key only. UI permission checks mirror, but never replace, database rules.

**Tech Stack:** Supabase (Postgres, Auth, Edge Functions, CLI), Vite 8, React 19, TypeScript, Tailwind 4, react-router v7, @supabase/supabase-js v2, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-12-admin-foundation-design.md`. Branch `feat/admin-foundation`. Paths are relative to `Medium--main/`.

> **Amendment (2026-10-12):** see the spec's Amendment section. Task 2 creates the default admin with `scripts/create-default-admin.mjs` instead of `create-first-admin.mjs`; Task 3 builds `manage-staff` (create, reset_password) instead of `invite-staff`; Task 1 adds `must_change_password` and `clear_password_flag()` with tests (only own row; flag cleared; RPC can't touch others). Admin-app tasks 4 and 6 were updated accordingly.

## Global Constraints

- Roles exactly: `admin`, `sales`, `events`, `finance` (enum `staff_role`).
- Every table has RLS enabled; default deny. Only the anon key in `admin/`; the service-role key only in Edge Function secrets and the git-ignored `supabase/.env.local`.
- No public sign-up. Profiles created only by `invite-staff` or `scripts/create-first-admin.mjs`.
- Nobody changes their own `role` or `active`; zero active admins is impossible.
- `activity_log` rows are written only by trigger; no update/delete for any client role.
- Password minimum length 10; inactivity timeout 8 hours.
- Admin app is `noindex` and has `robots.txt` `Disallow: /`.
- Palette identical to the site's `src/design/palette.ts`.
- No Docker: database work is applied to and tested against the hosted **dev** project only.

## Blocker and task order

Tasks 0, 4, 5, 6, 7 need no Supabase project (client mocked in tests). Tasks 1–3 and 8 need the dev project linked (spec §8). Execute 0 → 4 → 5 → 6 → 7 first; run 1 → 2 → 3 → 8 once the user has created and linked `medium-dev`. If the project isn't ready when 7 completes, stop and ask.

## Review Focus

1. **Staff deactivated during a session** — their next data request must fail and the app must sign them out — test in Task 4 (client) and Task 1 (RLS).
2. **Two admins demoting/deactivating each other at the same time** — must never leave zero active admins — test in Task 1 (serialised check under row lock).
3. **Invite where the auth user exists but no profile** (a half-failed earlier invite) — must return a clear error, not a 500, and be recoverable — test in Task 3.
4. **Update that changes nothing** — must not write an empty `activity_log` row — test in Task 1.
5. **Role badge and sidebar after an admin changes your role** — refreshed on next navigation, not stale until re-login — test in Task 4.

---

### Task 0: Admin app scaffold and Supabase project files

**Files:** Create `admin/package.json`, `admin/index.html`, `admin/vite.config.ts`, `admin/vitest.config.ts`, `admin/tsconfig.json`, `admin/src/main.tsx`, `admin/src/index.css`, `admin/src/test-setup.ts`, `admin/public/robots.txt`, `admin/.env.example`, `admin/src/design.test.ts`; run `npx supabase init` at repo root (creates `supabase/config.toml`); add `supabase` CLI as root devDependency; root `.gitignore` gains `supabase/.env.local`, `supabase/.temp/`.

**Interfaces — Produces:** `admin` scripts `dev` (port 3010), `build`, `lint` (`tsc --noEmit`), `test` (`vitest run`); alias `@site/*` → `../src/*`.

- [ ] **Step 1: Failing test** `admin/src/design.test.ts`: every `PALETTE` key from `@site/design/palette` appears in `admin/src/index.css` as `--color-<kebab>: <hex>` (case-insensitive), except `white`.
- [ ] **Step 2:** `npm --prefix admin test` → FAIL.
- [ ] **Step 3:** Scaffold; copy the `@theme` block; `index.html` has `<meta name="robots" content="noindex">`; `robots.txt` `User-agent: *\nDisallow: /`; `.env.example` documents `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- [ ] **Step 4:** `npm --prefix admin test`, `npm --prefix admin run lint`, `npm --prefix admin run build` → pass. Root `npm test` still passes (admin tests excluded from root vitest `include`).
- [ ] **Step 5:** In `supabase/config.toml` set `[auth] enable_signup = false`, `minimum_password_length = 10`, `site_url`/`additional_redirect_urls` = `http://localhost:3010`. Commit `chore: scaffold admin app and supabase project`.

### Task 1: Schema, roles, RLS and audit (migration)

**Files:** Create `supabase/migrations/20261012000001_foundation.sql`, `supabase/tests/foundation.test.ts`, `supabase/tests/helpers.ts`, `supabase/vitest.config.ts`; root script `test:db` = `vitest run --config supabase/vitest.config.ts`.

**Interfaces — Produces:** enum `staff_role`; tables `profiles`, `activity_log` (spec §3); functions `current_role()`, `is_active_staff()`, `has_role(variadic staff_role[])`, `log_activity()`, `guard_profile_change()`, `set_updated_at()`; test helpers `signInAs(role: 'admin'|'sales'|'events'|'finance'|'inactive'): Promise<SupabaseClient>`, `serviceClient(): SupabaseClient` (reads `supabase/.env.local`).

- [ ] **Step 1: Failing tests** (`foundation.test.ts`, seeded users from Task 2 — write Task 2's seed script first if needed, it has no logic to test-drive):
  - each active role `select * from profiles` returns ≥ 5 rows; inactive user gets 0 rows.
  - admin updates `sales` user's role → succeeds; `sales` updating anyone → 0 rows affected/error; admin updating own `role` or `active` → error.
  - with exactly one active admin, demoting or deactivating them (via service client acting as second admin path: create a temp admin, have the temp admin demote the original, then the original's session demote the temp) → second operation errors with `last active admin`.
  - concurrent: two admins each demote the other in parallel `Promise.all` → at least one fails; afterwards ≥ 1 active admin.
  - insert into `profiles` as any role → error.
  - after admin changes `events` user's `full_name`, `activity_log` has a row `{table_name:'profiles', action:'update', changes:{full_name:{old,new}}}` with `actor_id` = admin id; an update setting the same value writes no row.
  - `activity_log`: admin reads rows by others; `finance` reads only rows where `actor_id` = self; update/delete as any role → 0 rows / error.
- [ ] **Step 2:** `npx supabase db push` (empty) then `npm run test:db` → FAIL (tables missing).
- [ ] **Step 3:** Write the migration. `guard_profile_change` (before update): raise if `new.id = auth.uid()` and (`role` or `active` changed); if the row is an active admin and the update makes it non-admin or inactive, `lock` admin rows (`select … for update` on active admins) and raise `last active admin` when no other active admin remains. `log_activity` builds `changes` from `to_jsonb(old)`/`to_jsonb(new)` diff, skipping when empty. `revoke update, delete on activity_log from anon, authenticated`.
- [ ] **Step 4:** `npx supabase db push`, `npm run test:db` → PASS. `npx supabase gen types typescript --linked > admin/src/lib/database.types.ts`.
- [ ] **Step 5:** Commit `feat: foundation schema, roles, RLS and audit log`.

### Task 2: Dev seed and first-admin bootstrap

**Files:** Create `supabase/seed/seed-test-users.mjs`, `scripts/create-first-admin.mjs`, `supabase/.env.example`.

**Interfaces — Produces:** seed users `test-admin@medium.test`, `test-sales@…`, `test-events@…`, `test-finance@…`, `test-inactive@…` (password from `TEST_USER_PASSWORD` in `supabase/.env.local`); idempotent. `create-first-admin.mjs --email <e> --name <n>` invites and inserts an admin profile; refuses if any active admin exists.

- [ ] **Step 1:** Write both scripts (service client from `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `supabase/.env.local`); seed refuses to run unless `SUPABASE_URL` contains the dev project ref in `supabase/.env.local` `DEV_PROJECT_REF`.
- [ ] **Step 2:** Run seed twice → second run reports "already exists" for each, no errors; `npm run test:db` still green.
- [ ] **Step 3:** Commit `chore: dev test users and first-admin bootstrap`.

### Task 3: `invite-staff` Edge Function

**Files:** Create `supabase/functions/invite-staff/index.ts`, `supabase/functions/invite-staff/validate.ts`, `supabase/tests/invite.test.ts`, `admin/src/lib/inviteValidation.test.ts` (validator shared by copy-free import: admin imports `../../supabase/functions/invite-staff/validate.ts`).

**Interfaces — Produces:** `validateInvite(input: unknown): { ok: true; value: { email: string; full_name: string; role: StaffRole } } | { ok: false; error: string }`; HTTP: 200 `{ok:true}`, 400 `{ok:false,error}`, 403 `{ok:false,error:'Only active admins can invite staff.'}`, 409 for existing email.

- [ ] **Step 1: Failing tests** — `validateInvite`: rejects bad email, blank name, unknown role, trims/lowercases email. `invite.test.ts`: as `sales` → 403; as inactive admin → 403; bad body → 400; existing profile email → 409 `That email already has an account.`; auth user without profile (create via service client) → 409 `An unfinished invite exists for this email. Ask a developer to remove it in Supabase Auth.`; valid invite as admin → 200, profile row exists with role; cleanup deletes the auth user.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** Implement; `supabase secrets set ADMIN_URL=http://localhost:3010`; `npx supabase functions deploy invite-staff --use-api`.
- [ ] **Step 4:** `npm run test:db` and `npm --prefix admin test` → PASS.
- [ ] **Step 5:** Commit `feat: invite-staff edge function`.

### Task 4: Auth in the admin app

**Files:** Create `admin/src/lib/supabase.ts`, `admin/src/lib/auth.tsx`, `admin/src/pages/LoginPage.tsx`, `admin/src/pages/SetPasswordPage.tsx`, `admin/src/components/RequireAuth.tsx`, `admin/src/App.tsx`, `admin/src/lib/auth.test.tsx`.

**Interfaces — Produces:** `useAuth(): { session; profile: Profile | null; role: StaffRole | null; loading: boolean; signIn(email, password): Promise<string | null /* error */>; signOut(): Promise<void>; refreshProfile(): Promise<void> }`; `<RequireAuth roles?: StaffRole[]>`.

- [ ] **Step 1: Failing tests** (mock `supabase` module): signed out → `/` redirects to `/login`; sign-in error shows "Email or password is incorrect."; signed in with inactive profile → signed out and shown "Your account is deactivated."; a data call returning 401/RLS-empty profile on navigation triggers `refreshProfile` and sign-out (Review Focus 1); profile role changes between navigations → sidebar role badge updates after navigation (Review Focus 5); `/set-password` rejects < 10 chars and mismatched confirmation.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** Implement; `refreshProfile` runs on every route change.
- [ ] **Step 4:** pass; lint clean.
- [ ] **Step 5:** Commit `feat: admin sign-in and session handling`.

### Task 5: Layout, permissions and dashboard

**Files:** Create `admin/src/lib/permissions.ts`, `admin/src/components/Layout.tsx`, `admin/src/pages/DashboardPage.tsx`, `admin/src/pages/NotFoundPage.tsx`, `admin/src/components/Layout.test.tsx`.

**Interfaces — Produces:** `NAV_ITEMS: { id: 'dashboard'|'staff'|'activity'; label: string; path: string; roles: StaffRole[] }[]`; `canSee(role, id): boolean`.

- [ ] **Step 1: Failing tests** — admin sees Dashboard, Staff, Activity log; sales/events/finance see Dashboard, Activity log; non-admin at `/staff` sees "You don't have access to this page"; top bar shows full name and role label ("Admin", "Sales", "Events", "Finance"); Sign out calls `signOut`; mobile menu toggles.
- [ ] **Step 2:** FAIL. **Step 3:** implement (corporate style, sidebar collapses under `lg`). **Step 4:** pass. **Step 5:** commit `feat: admin layout and role-based navigation`.

### Task 6: Staff page

**Files:** Create `admin/src/lib/staff.ts`, `admin/src/pages/StaffPage.tsx`, `admin/src/pages/StaffPage.test.tsx`.

**Interfaces — Consumes:** `validateInvite` (Task 3; until Task 3 lands, import path exists from Task 3 Step 3 — if executing Task 6 before Task 3, create `validate.ts` first with its tests from Task 3 Step 1). **Produces:** `listStaff(): Promise<Profile[]>`, `inviteStaff(input): Promise<{ ok: boolean; error?: string }>` (calls `functions.invoke('invite-staff')`), `updateStaff(id, patch: { role?: StaffRole; active?: boolean }): Promise<{ ok: boolean; error?: string }>` mapping the DB `last active admin` error to "There must always be at least one active admin."

- [ ] **Step 1: Failing tests** — list renders name, email, role, status; invite dialog validates and shows server error text; on own row the role select and deactivate button are disabled with a tooltip "You can't change your own access"; deactivate asks for confirmation; last-admin error message shown.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** pass. **Step 5:** commit `feat: staff management page`.

### Task 7: Activity log page

**Files:** Create `admin/src/lib/activity.ts`, `admin/src/pages/ActivityPage.tsx`, `admin/src/pages/ActivityPage.test.tsx`.

**Interfaces — Produces:** `listActivity(f: { actorId?: string; table?: string; action?: string; from?: string; to?: string; page: number }): Promise<{ rows: ActivityRow[]; total: number }>` (50 per page, newest first).

- [ ] **Step 1: Failing tests** — filters map to the right query calls (mocked builder records `eq`/`gte`/`lte`/`range`); rows show who (name, or "System" for null actor), when (Maldives time), action, table and a readable change summary (`full_name: "A" → "B"`); non-admins don't see the person filter.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** pass. **Step 5:** commit `feat: activity log page`.

### Task 8: Docs and end-to-end verification

- [ ] **Step 1:** README section "Admin backend": setup (create project, `supabase login`, `supabase link`, `db push`, deploy function, secrets, `.env` files, seed, first admin), Auth settings to set in the dashboard (sign-ups off, leaked-password protection on, inactivity timeout 8h, redirect URLs), commands.
- [ ] **Step 2:** `npm --prefix admin run lint && npm --prefix admin test && npm --prefix admin run build && npm run test:db && npm test && npm run build` → all pass.
- [ ] **Step 3:** Browser on the dev project: sign in as each seeded role at 1280px and 375px — navigation per role, staff invite (to a throwaway address the user provides), role change, deactivate then sign in as that user, activity log entries; no console errors.
- [ ] **Step 4:** Commit `docs: admin backend setup`.
