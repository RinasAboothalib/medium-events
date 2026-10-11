# Admin Backend — Piece 1: Foundation (Supabase, Roles, Staff, Activity Log)

> **Superseded 2026-10-13** by `2026-10-13-admin-backend-design.md`: Supabase is now used only as a database; accounts and sessions moved to our own server.

**Date:** 2026-10-12
**Status:** Approved in conversation, awaiting spec review
**Builds on:** branch `feat/international-redesign` (public site). Public site behaviour is unchanged by this piece.

## Amendment (approved in conversation, 2026-10-12)

This amendment supersedes the parts of sections 1, 4, 5, 7 and 8 that mention email invitations, password-reset emails or `/set-password`.

- **No emails from Supabase.** Supabase is used for sign-in checking and data storage only.
- **Default admin:** the setup script `scripts/create-default-admin.mjs` creates `admin@medium.mv` (overridable with `--email`) with the password from `DEFAULT_ADMIN_PASSWORD` in `supabase/.env.local` (never in code). It refuses to run if any active admin exists.
- **`profiles.must_change_password boolean not null default true`.** Set on account creation and on admin password reset. While true, the admin app only allows `/change-password`. Cleared by the `security definer` RPC `clear_password_flag()`, which only touches `auth.uid()`'s row.
- **Edge Function `manage-staff`** (replaces `invite-staff`), active admins only:
  - `{ action: 'create', email, full_name, role, temp_password }` → `auth.admin.createUser({ email, password, email_confirm: true })` + profile insert. 409 for an existing email.
  - `{ action: 'reset_password', user_id, temp_password }` → `auth.admin.updateUserById` + set `must_change_password = true`. Refuses the caller's own id.
  - Temporary passwords need at least 10 characters (`supabase/functions/manage-staff/validate.ts`, shared with the admin app).
- **Admin app:** "Forgot password?" removed (staff ask an admin); `/set-password` replaced by the forced `/change-password` page; Staff page has "Add staff" (with temporary password) and "Reset password" per person (not for yourself).
- **Development demo mode removed.**

## 1. Context and goal

MEDIUM wants a backend for event management and report management with report generation. Agreed decomposition (each piece gets its own spec):

1. **Foundation (this spec):** Supabase project, roles and access rules, staff login, staff management, activity log, admin app shell.
2. **Event management:** series, editions, venues, photos, partners; Publish rebuilds the public site from the database.
3. **Enquiries and sponsorship:** website enquiries stored with a pipeline; sponsor deals, packages, amounts, payments.
4. **Reports:** post-event PDF, sponsorship PDF and Excel, enquiry Excel, generated in the admin app.

Chosen architecture (approach A): a separate static admin app on Supabase (managed Postgres, Auth, Storage, Edge Functions). The public site stays pre-rendered and, from piece 2, is rebuilt from database data on Publish.

### Roles (approved)

| Role | Can | Cannot |
|---|---|---|
| `admin` | Everything, including staff accounts | — |
| `sales` | Enquiries and sponsors: deals, packages, amounts; sales and enquiry reports | Edit public event content; record payments |
| `events` | Event series, editions, venues, photos, partners, post-event details; post-event reports | See sponsorship amounts or payments |
| `finance` | View sponsors and amounts; record payments and invoice status; sponsorship reports | Edit events or enquiries |

Piece 1 implements the role model and the rules for its own tables; pieces 2–4 apply the table above to their tables.

### Constraints

- No Docker on the developer PC: no local Supabase stack. Development uses a hosted free Supabase **dev** project containing test data only. Production is a separate project owned by MEDIUM's account, created later.
- Accounts are created by people, not by the assistant: the developer creates the dev project; MEDIUM creates production.
- The service-role (master) key is never committed, never shipped to the browser, and never pasted into chat.

### Success criteria

1. Only signed-in, active staff can read any data; every table has RLS enabled.
2. Role checks are enforced in the database (RLS + functions), not only in the UI.
3. Admins can invite staff by email with a role, change roles, deactivate and reactivate accounts; nobody can change their own role; the last active admin cannot be removed or demoted.
4. Every insert/update/delete on audited tables writes an `activity_log` row via trigger; nobody can update or delete log rows.
5. `npm test` (admin), `npm run test:db` (access rules against dev project), `npm run lint` and `npm run build` in `admin/` pass; the public site's own checks still pass.

## 2. Structure and tools

```
Medium--main/
  (public site, unchanged)
  admin/               Vite + React 19 + TypeScript + Tailwind 4 + react-router v7; same palette tokens
  supabase/
    config.toml
    migrations/        numbered SQL files (schema, RLS, triggers, functions)
    functions/invite-staff/   Edge Function (Deno)
    seed/              scripts to create test users (dev only)
  scripts/create-first-admin.mjs   one-off bootstrap, reads the service key from the environment
```

- Supabase CLI: `supabase link` to the dev project, `supabase db push` to apply migrations, `supabase functions deploy invite-staff` (API bundling, no Docker), `supabase gen types typescript --linked > admin/src/lib/database.types.ts`.
- The admin app imports the palette from the site (`src/design/palette.ts`) via a relative path alias so both stay identical; Tailwind `@theme` tokens copied into `admin/src/index.css` and checked equal by a test.

## 3. Data model (piece 1)

### `staff_role` enum

`'admin' | 'sales' | 'events' | 'finance'`

### `profiles`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | = `auth.users.id`, `on delete cascade` |
| `full_name` | text not null | |
| `email` | text not null unique | copied from auth on invite |
| `role` | `staff_role` not null | |
| `active` | boolean not null default true | |
| `created_at` | timestamptz default now() | |
| `updated_at` | timestamptz | set by trigger |

Profiles are created only by the `invite-staff` function or the bootstrap script (service role). No public sign-up: Supabase "Enable sign-ups" is off.

### `activity_log`

| Column | Type | Notes |
|---|---|---|
| `id` | bigint identity PK | |
| `at` | timestamptz default now() | |
| `actor_id` | uuid null | `auth.uid()` at write time; null for service-role actions |
| `table_name` | text | |
| `record_id` | text | primary key of the changed row as text |
| `action` | text | `insert` / `update` / `delete` |
| `changes` | jsonb | insert: new row; delete: old row; update: `{column: {old, new}}` for changed columns only |

Written only by the generic trigger function `log_activity()` (`security definer`). Attached to `profiles` in piece 1; later pieces attach it to their tables.

### Helper functions (SQL, `security definer`, `stable`)

- `current_role() returns staff_role` — role of `auth.uid()` if that profile is active, else null.
- `is_active_staff() returns boolean`
- `has_role(variadic roles staff_role[]) returns boolean`

### RLS policies

| Table | select | insert | update | delete |
|---|---|---|---|---|
| `profiles` | active staff: all rows | none (service role only) | admin only; `with check` forbids changing own `role` or `active`; a trigger blocks any change leaving zero active admins | none |
| `activity_log` | admin: all; other active staff: `actor_id = auth.uid()` | none (trigger only) | none | none |

Additionally `revoke update, delete on activity_log from authenticated, anon` as belt-and-braces.

## 4. Edge Function `invite-staff`

- `POST { email, full_name, role }` with the caller's JWT.
- Verifies the caller is an active admin (query `profiles` with the caller's id using the service client).
- Validates input (email format, non-empty name, role in enum); rejects existing emails with a clear message.
- Calls `auth.admin.inviteUserByEmail(email, { redirectTo: <ADMIN_URL>/set-password })`, then inserts the profile.
- Returns `{ ok: true }` or `{ ok: false, error }` with HTTP 400/403.
- Secrets: `SUPABASE_SERVICE_ROLE_KEY` (provided automatically to Edge Functions) and `ADMIN_URL` set with `supabase secrets set`.

## 5. Admin app

### Routes

| Path | Who | Content |
|---|---|---|
| `/login` | signed out | email + password, "Forgot password" |
| `/set-password` | invite / reset link | choose a password (min 10 chars) |
| `/` | active staff | Dashboard (welcome, role, quick links) |
| `/staff` | admin | Staff list; invite; edit role; deactivate/reactivate |
| `/activity` | active staff | Activity log (own actions; all for admin), filters: person, table, action, date range |
| `*` | — | not found |

Signed-out users are redirected to `/login`; non-admins visiting `/staff` see "You don't have access to this page". A deactivated user is signed out on their next request.

### Layout

White corporate style matching the site. Left sidebar (collapses to a menu on mobile) shows only sections the role can use; top bar shows name, role badge and Sign out. Sessions: Supabase JWT with refresh; inactivity timeout 8 hours (`auth.sessions.inactivity_timeout` in project settings).

### Modules

- `admin/src/lib/supabase.ts` — client from `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- `admin/src/lib/auth.tsx` — `AuthProvider`, `useAuth(): { session, profile, role, signIn, signOut, loading }`; loads the profile after sign-in; signs out if profile inactive or missing.
- `admin/src/lib/permissions.ts` — `NAV_ITEMS` with allowed roles; `canSee(role, section)` (UI only; the database is the real guard).
- `admin/src/lib/staff.ts` — `listStaff()`, `inviteStaff(input)`, `updateStaff(id, { role?, active? })`.
- `admin/src/lib/activity.ts` — `listActivity(filters)`.

### Hosting

Static build deployed separately (e.g. `admin.medium.mv`); `robots.txt` `Disallow: /` and `<meta name="robots" content="noindex">`.

## 6. Security

- Only the anon (public) key in the browser; all tables RLS-enabled; default deny.
- Service-role key only in Edge Function secrets and the developer's local environment for the one-off bootstrap and dev test-user seeding; never committed (`.env*` already git-ignored).
- Password policy: minimum length 10; leaked-password protection enabled in Auth settings.
- Supabase Auth settings recorded in `supabase/config.toml` and the README (sign-ups disabled, site URL / redirect URLs = admin URL).

## 7. Testing

- **Admin app (`admin/`, Vitest + Testing Library, Supabase client mocked):** redirect to `/login` when signed out; sidebar items per role; `/staff` access denied for non-admin; invite form validation and server-error display; self-deactivate and self-role-change controls disabled; activity filters build the right query.
- **Access rules (`npm run test:db`, Vitest in Node, against the dev project):** seed script creates one test user per role plus an inactive admin (service key from local env). Tests sign in as each user with the anon key and assert:
  - every role can read `profiles`; inactive user reads nothing;
  - only admin can update another profile's role/active; nobody can change their own role/active;
  - demoting/deactivating the last active admin fails;
  - insert into `profiles` fails for all roles;
  - `activity_log`: admin reads all, others only own rows; update/delete fail for everyone;
  - updating a profile writes an `activity_log` row with the changed columns;
  - `invite-staff` returns 403 for non-admin and inactive admin, 400 for bad input, and succeeds for an active admin (test invite to a throwaway address is then deleted via service client).
- **Browser:** sign in as each role on the dev project; every screen at 1280px and 375px.
- **Final fresh whole-branch review.**

## 8. Prerequisites (people)

1. Developer creates a free Supabase account and a `medium-dev` project; shares the project URL and anon key.
2. Developer runs `supabase login` and `supabase link` locally (the CLI stores its own token; nothing pasted into chat), and puts the service-role key in a local, git-ignored `supabase/.env.local` for seeding and bootstrap.
3. Later: MEDIUM creates the production project under their own account.

## 9. Out of scope (piece 1)

Event, enquiry, sponsorship and report tables and screens (pieces 2–4); two-factor authentication; SSO; email templates beyond Supabase defaults (subject/branding tweaks noted for later); production deployment.
