# MEDIUM Admin Backend — Architecture and Modules

**Date:** 2026-10-13
**Status:** Design approved in conversation; awaiting spec review
**Supersedes:** `2026-10-12-admin-foundation-design.md` (Supabase Auth, RLS-as-security, Edge Functions). The admin app UI from that work (layout, roles, staff, activity pages, forced password change) is kept and rewired to this server.

## 1. Goals and decisions

- **Supabase is used only as a PostgreSQL database.** No Supabase Auth, no emails, no Edge Functions, no Data API access.
- **Our own server** (`server/`) owns accounts, sessions, roles, business logic, files and reports. The admin app talks only to it.
- **Works today without any keys:** with `DATABASE_URL` unset, the server uses an embedded Postgres (PGlite) persisted in `server/.data/`. Setting `DATABASE_URL` to the Supabase connection string switches storage to Supabase with the same SQL.
- **Default admin:** on first start with no users, the server creates `admin@medium.mv` with password `DEFAULT_ADMIN_PASSWORD` or, if unset, `Medium@2026!`; `must_change_password = true`.
- **Roles (unchanged):** `admin`, `sales`, `events`, `finance` (permission matrix in §5).
- **Currencies:** `MVR`, `USD`.
- **Everything is logged** in `activity_log` by the server.

### Success criteria

1. Fresh clone → `npm --prefix server run dev` + `npm --prefix admin run dev` → sign in as the default admin → forced password change → full app usable, without any Supabase keys.
2. Same server runs against Supabase by setting `DATABASE_URL` only.
3. Every API route enforces the permission matrix; tests cover every role × route.
4. Events users never receive sponsorship amounts or payments from any route.
5. Reports download as valid PDF / XLSX with correct totals.
6. Publishing produces the site data the public website builds from; the public site build still passes with or without published data.
7. `npm test`, `npm run lint`, `npm run build` pass in `server/`, `admin/` and the site.

## 2. Architecture

```
public site (static) ──POST /api/public/enquiries──▶
                       ◀─GET /api/public/site-data── server/ (Node 22, Express) ──SQL──▶ PostgreSQL
admin app (static, served by server in production) ──/api/* (cookie session)──▶            (PGlite locally / Supabase live)
```

- **Server:** Node 22, Express 4, TypeScript (run with `tsx` in dev, compiled with `tsc` for production). Port `PORT` (default 3020).
- **Admin app in development:** Vite on 3010 proxies `/api` to 3020 (same-origin cookies). **In production:** the server serves the built admin app and `/api` from one origin.
- **Database layer:** `server/src/db/index.ts` exposes `Db { query<T>(sql, params?): Promise<T[]>; transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> }` with two implementations: PGlite (`@electric-sql/pglite`, data dir `server/.data/pg`, or in-memory for tests) and node-postgres `Pool` (`DATABASE_URL`, SSL on).
- **Migrations:** numbered SQL files in `server/migrations/`, applied at startup in order, recorded in `schema_migrations`.
- **Supabase hardening:** a migration enables row-level security on every table with no policies, so Supabase's public API (anon key) can read nothing; the server connects as the database owner and is unaffected.
- **Files** (banners, gallery images) are stored in Postgres (`files` table, `bytea`, ≤ 5 MB, `image/jpeg|png|webp` only), so they persist in Supabase without Storage.

## 3. Data model

| Table | Key columns |
|---|---|
| `users` | id uuid, email unique (lower-case), full_name, role, active, password_hash (bcrypt, cost 12), must_change_password, last_login_at, created_at, updated_at |
| `sessions` | token_hash (sha-256, PK), user_id → users, created_at, last_seen_at, expires_at |
| `activity_log` | id, at, actor_id → users (null = system), entity (text), entity_id (text), action (`create`/`update`/`delete`/`login`/`publish`/`export`), changes jsonb |
| `files` | id uuid, filename, content_type, size, data bytea, created_by, created_at |
| `event_series` | id, slug unique, name, short_name, tagline, description text[], website, endorsement, audience, usual_venue, usual_month, cta_secondary, sort_order, active |
| `editions` | id, series_id → event_series, name, start_date, end_date, venue, description, rsvp_count, attendance, facebook_url, banner_file_id → files, status (`upcoming`/`past`/`cancelled`), outcome_notes |
| `partners` | id, name, role, series_id (nullable), edition_id (nullable), sort_order — at least one of series_id/edition_id |
| `published_snapshots` | id, published_at, published_by, data jsonb |
| `enquiries` | id, created_at, full_name, company, email, phone, service, event, timeline, message, source (`website`/`whatsapp`/`phone`/`email`/`walk_in`/`other`), status (`new`/`contacted`/`proposal_sent`/`won`/`lost`), assignee_id → users, edition_id (nullable) |
| `enquiry_notes` | id, enquiry_id, author_id, body, created_at |
| `sponsors` | id, company, contact_name, email, phone, notes, created_at |
| `deals` | id, sponsor_id, edition_id, package, amount numeric(12,2), currency (`MVR`/`USD`), status (`proposed`/`confirmed`/`cancelled`), enquiry_id (nullable), notes, created_by, created_at |
| `payments` | id, deal_id, amount numeric(12,2), paid_on date, method (`bank_transfer`/`cash`/`cheque`/`card`/`other`), invoice_no, notes, recorded_by, created_at |

Payment currency is the deal's currency. Totals never mix currencies; reports group by currency.

Seed migration: the four current series and nine past editions from the site's `websiteData.ts` (with their banner images) and the verified partners, so the admin starts with real data.

## 4. Authentication

- `POST /api/auth/login {email, password}` → on success sets cookie `medium_session` (random 32 bytes, base64url; stored as sha-256 hash), `HttpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/`. Generic error "Email or password is incorrect." for any failure, including inactive users.
- Lockout: 5 failed attempts for an email within 15 minutes → further attempts refused for 15 minutes ("Too many attempts. Try again in 15 minutes."). In-memory; resets on restart.
- Sessions expire after 8 hours without activity and 30 days absolute. `last_seen_at` updated at most once a minute.
- `GET /api/auth/me` → `{ id, email, full_name, role, must_change_password }`.
- `POST /api/auth/logout` → deletes the session, clears the cookie.
- `POST /api/auth/change-password {current_password, new_password}` → min 10 characters, must differ from current; clears `must_change_password`; deletes the user's other sessions.
- While `must_change_password` is true, every route except `me`, `logout` and `change-password` returns 403 `{ error: 'password_change_required' }`.
- Deactivating a user deletes their sessions immediately.
- Default admin creation is logged; while the default admin still has `must_change_password` the server prints a warning at startup.

## 5. Permissions

| Area | admin | sales | events | finance |
|---|---|---|---|---|
| Staff: list | ✓ | ✓ (names, roles only) | ✓ (names, roles only) | ✓ (names, roles only) |
| Staff: create, edit role, deactivate, reset password | ✓ | | | |
| Activity log | all | own | own | own |
| Event series, editions, partners, files: read | ✓ | ✓ | ✓ | ✓ |
| Event series, editions, partners, files: write | ✓ | | ✓ | |
| Publish to website | ✓ | | ✓ | |
| Enquiries: read, create, update, notes, assign | ✓ | ✓ | | |
| Sponsors: read | ✓ | ✓ | ✓ | ✓ |
| Sponsors: write | ✓ | ✓ | | |
| Deals: read with amounts | ✓ | ✓ | | ✓ |
| Deals: read without amounts (sponsor, edition, package, status) | | | ✓ | |
| Deals: write | ✓ | ✓ | | |
| Payments: read | ✓ | ✓ | | ✓ |
| Payments: write | ✓ | | | ✓ |
| Report: post-event (PDF) | ✓ | | ✓ | |
| Report: sponsorship (PDF, XLSX) | ✓ | ✓ | | ✓ |
| Report: enquiries (XLSX) | ✓ | ✓ | | |

Rules in addition to the matrix: nobody changes their own role or active status or resets their own password via staff routes; there is always at least one active admin (checked inside a transaction holding an advisory lock).

The matrix lives in one module (`server/src/permissions.ts`) that both route guards and tests import; the admin app mirrors it for navigation.

## 6. API

All JSON; validation with `zod`; errors `{ error: string, fields?: Record<string,string> }` with 400/401/403/404/409.

- **Staff:** `GET/POST /api/staff`, `PATCH /api/staff/:id` (`role`, `active`, `full_name`), `POST /api/staff/:id/reset-password {temp_password}`.
- **Activity:** `GET /api/activity?actor&entity&action&from&to&page` (50 per page, newest first, Maldives-date filters).
- **Events:** `GET/POST /api/series`, `GET/PATCH/DELETE /api/series/:id`; `GET/POST /api/editions?series_id`, `GET/PATCH/DELETE /api/editions/:id`; `GET/POST /api/partners`, `PATCH/DELETE /api/partners/:id`; `POST /api/files` (multipart, one image), `GET /api/files/:id`. Deleting a series with editions → 409.
- **Publish:** `POST /api/publish` → builds the snapshot (active series in `sort_order`, their non-cancelled editions newest first, partners, banner URLs `/api/public/files/:id`), stores it, logs it; optional `SITE_DEPLOY_HOOK_URL` is POSTed to trigger a site rebuild. `GET /api/publish/latest`.
- **Public (no login, CORS limited to `PUBLIC_SITE_ORIGIN`):** `GET /api/public/site-data` (latest snapshot or 404), `GET /api/public/files/:id` (only files referenced by the latest snapshot), `POST /api/public/enquiries` (same fields as the site form; honeypot `botcheck`; 10 requests/IP/hour).
- **Enquiries:** `GET /api/enquiries?status&source&assignee&q&from&to&page`, `POST /api/enquiries` (manual entry), `GET/PATCH /api/enquiries/:id`, `POST /api/enquiries/:id/notes`.
- **Sponsors and deals:** `GET/POST /api/sponsors`, `GET/PATCH /api/sponsors/:id`; `GET /api/deals?edition_id&sponsor_id&status`, `POST /api/deals`, `PATCH /api/deals/:id`; amounts stripped for `events`.
- **Payments:** `GET /api/deals/:id/payments`, `POST /api/deals/:id/payments`, `DELETE /api/payments/:id` (admin only).
- **Reports:** `GET /api/reports/post-event/:editionId.pdf`, `GET /api/reports/sponsorship.pdf|.xlsx?edition_id|from&to`, `GET /api/reports/enquiries.xlsx?from&to&status&source`. Every export is logged (`export`).
- **Dashboard:** `GET /api/dashboard` → role-specific figures: admin/sales: new enquiries (7 days), open enquiries, confirmed deals this month; finance: outstanding by currency, payments this month; events: upcoming editions, last publish time.

## 7. Reports

- **PDF** with `pdfkit`, A4, MEDIUM header (logo mark + wordmark text), brand blue headings, footer "Generated by MEDIUM Admin on <date, Maldives time> · page n of m".
- **Post-event:** edition name, dates, venue, series, description, RSVP count, attendance, partners, confirmed sponsors (name and package — no amounts), outcome notes, banner image.
- **Sponsorship:** per edition or date range: table of deals (sponsor, edition, package, status, amount, paid, outstanding) grouped by currency with totals; cancelled deals listed separately and excluded from totals.
- **XLSX** with `exceljs`: one header row, frozen, auto-filter, typed number and date cells; sponsorship workbook has `Deals` and `Payments` sheets; enquiries workbook has one sheet with all enquiry fields and the latest note.

## 8. Public site integration

- The enquiry form posts to `VITE_ADMIN_API_URL/api/public/enquiries` in addition to the existing Web3Forms/WhatsApp flow; failure of this call never blocks the visitor.
- `npm run build` gains a prebuild step `scripts/fetch-site-data.mjs`: when `VITE_ADMIN_API_URL` is set it downloads `/api/public/site-data` and banner files into `src/data/published.json` and `public/images/cms/`; `websiteData.ts` uses the published data when present, otherwise its current built-in data. Build failures in fetching fall back to built-in data with a warning.

## 9. Admin app

Replaces the Supabase client with `admin/src/lib/api.ts` (fetch wrapper, cookie credentials, typed errors; 401 → sign-in page; `password_change_required` → change-password page).

| Section | Roles | Content |
|---|---|---|
| Dashboard | all | role figures and shortcuts |
| Events | admin, events (others read-only) | series list → series editor (details, partners) → editions list → edition editor (details, banner upload, status, outcome notes, attendance) |
| Publish | admin, events | last publish, preview counts, "Publish to website" |
| Enquiries | admin, sales | filterable list, detail (status, assignee, notes, link to deal), "Add enquiry" |
| Sponsors | all (read); admin, sales (write) | sponsor list and detail with deals |
| Deals | admin, sales, finance; events read without amounts | per edition and per sponsor, totals by currency |
| Payments | admin, finance (write); sales (read) | within a deal: record payment, outstanding |
| Reports | per matrix | pick report + filters → download |
| Staff | admin | create with temporary password, edit, reset password, deactivate |
| Activity log | all (own unless admin) | filters, pagination |
| My account | all | change password |

## 10. Testing

- **Server (`server/`, Vitest + supertest, PGlite in-memory per test file):** auth (login, lockout, expiry, forced change, deactivation kills sessions); permission matrix: every route × role from `permissions.ts`; amounts never present for `events` (deep scan of JSON); last-admin and self-change rules; validation errors; activity rows for every write; publish snapshot shape; public enquiry honeypot and rate limit; reports: PDF starts with `%PDF`, XLSX parsed back with `exceljs` and totals checked.
- **Admin app:** component tests with `api` mocked, per section; existing tests ported.
- **Site:** form posting to the API (mocked fetch), build with and without published data.
- **Browser:** sign in as default admin; full flows per role at 1280px and 375px.
- **Final fresh review.**

## 11. Configuration

`server/.env` (git-ignored; `.env.example` documented):
`PORT`, `DATABASE_URL` (blank = local PGlite), `DEFAULT_ADMIN_PASSWORD`, `PUBLIC_SITE_ORIGIN`, `SITE_DEPLOY_HOOK_URL`, `NODE_ENV`.

To use Supabase: Supabase → Project Settings → Database → Connection string (Session pooler, URI) → paste into `DATABASE_URL` with the database password.

## 12. Build order (one plan per phase)

1. Server foundation and login (default admin; admin app rewired; staff; activity)
2. Event management and publishing (incl. site integration and seed data)
3. Enquiries (incl. public endpoint and site form)
4. Sponsors, deals and payments
5. Reports and dashboard figures

## 13. Out of scope

Email sending of any kind; two-factor login; online delegate registration; payment gateways; multi-language; hosting set-up (documented, not performed).
