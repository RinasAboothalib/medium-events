# Admin Backend Phases 2–5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Event management with publishing to the website, enquiries (incl. the public site form), sponsors/deals/payments, and PDF/XLSX reports with role dashboards, on the MEDIUM server built in phase 1.

**Architecture:** Each module is a migration + an Express router in `server/src/<module>/routes.ts` guarded by `requirePermission`, writing `activity_log` in the same transaction, plus an admin section in `admin/src/pages/`. The public site reads a published snapshot at build time and posts enquiries to the server.

**Tech Stack:** Express 4, zod, PGlite/pg, pdfkit, exceljs (server); React 19, react-router 7, Tailwind 4 (admin); Vitest + supertest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-13-admin-backend-design.md` (§3 data model, §5 permissions, §6 API, §7 reports, §8 site integration, §9 admin app). Phase 1 plan: `docs/superpowers/plans/2026-10-13-backend-phase1-server-and-login.md`.

## Global Constraints

- Supabase is only a database: no Supabase client, auth, storage or keys anywhere.
- Roles `admin`, `sales`, `events`, `finance`; guards use `server/src/permissions.ts` names only (already defined in phase 1).
- Currencies `MVR`, `USD`; totals never mix currencies; reports group by currency.
- Events users never receive deal amounts or payments from any route (deep JSON scan in tests).
- Every write and every export is logged in `activity_log` inside the same transaction (`export` logged on download).
- Errors `{ error, fields? }`, statuses 400/401/403/404/409; field messages in plain English.
- Files: `image/jpeg|png|webp` only, ≤ 5 MB, stored in Postgres `bytea`.
- Dates shown in Maldives time (`Indian/Maldives`); date filters are Maldives calendar days.
- Only verified facts in seed data (copied from `src/data/websiteData.ts`); no invented events, partners or numbers.
- New migrations enable RLS with no policies on every new table.
- Admin UI copy, components and Tailwind tokens follow the existing pages (`StaffPage.tsx` patterns: `FIELD`, `PRIMARY`, `SECONDARY` classes, `role="alert"`/`role="status"` messages).

## Review Focus

1. Deleting a series that still has editions, or a file still used as a banner → 409 with a plain message, nothing deleted. (Task 2 tests.)
2. Publishing with zero active series / zero editions → valid snapshot; site build falls back to built-in data only when no snapshot exists. (Tasks 3 and 5 tests.)
3. Public enquiry spam: honeypot filled → 200 but nothing stored; 11th request from one IP within an hour → 429. (Task 6 tests.)
4. Payments exceeding the deal amount are allowed but outstanding shows negative as "overpaid"; a payment on a cancelled deal → 409. (Task 8 tests.)
5. Amount strings like `"1,500.50"` or `"abc"` from the admin form → validation message, never NaN in the database. (Task 8 tests.)

## Rulings recorded before execution

- `event_series` gains `label` (the short grouping name the site shows on edition cards, e.g. "Aviation Forum"); the spec's `name` is the full title. Cost if wrong: one column.
- `POST /api/files` takes the raw image body (`Content-Type: image/*`, `?filename=`) instead of multipart: one request, no multipart dependency. Cost if wrong: client upload code only.
- Seed data (4 series, 9 editions, banners, partners) ships as `server/seed/events.json` + `server/seed/images/`, applied once at start-up and recorded as `seed:events-v1` in `schema_migrations`, so deleting seeded rows never re-creates them.
- The snapshot carries `upcoming` editions separately; the current site renders only `events` (past editions).
- Amounts are `numeric(12,2)` in SQL and returned as JSON numbers.

---

## Phase 2 — Events and publishing

### Task 1: Events schema and seed data

**Files:** Create `server/migrations/002_events.sql`, `server/src/seed.ts`, `server/seed/events.json`, `server/seed/images/*.jpg` (copied from `public/images/fb/`), `server/scripts/export-seed.ts` (one-off generator from `src/data/websiteData.ts`), `server/src/seed.test.ts`. Modify `server/src/index.ts` (call `seedEvents` after migrate).

**Interfaces:**
- Produces tables per spec §3: `files`, `event_series` (+ `label text not null`), `editions`, `partners` (check `series_id is not null or edition_id is not null`), `published_snapshots`.
- Produces `seedEvents(db: Db, dir: string): Promise<'seeded' | 'skipped'>`.

- [ ] Test `seedEvents`: on a fresh migrated db → `'seeded'`; 4 series in `sort_order` (CIF, MMIF, Aviation Forum, Build Expo), 9 editions all `status='past'`, each with a banner file whose `content_type='image/jpeg'`; partners MNACI, Ooredoo Maldives, SITA attached as in `EVENT_SERIES`; second call → `'skipped'`; after deleting all series, a third call → `'skipped'`; one `activity_log` row `entity='seed'`.
- [ ] Run → fails. Implement migration + seed + generator (run `npx tsx server/scripts/export-seed.ts` once, commit its output). Run server tests → pass. Commit `feat: events schema and seed data`.

### Task 2: Files, series, editions and partners API

**Files:** Create `server/src/files/routes.ts`, `server/src/events/routes.ts`, `server/src/events/events.test.ts`, `server/src/files/files.test.ts`. Modify `server/src/app.ts` (mount `/api/files`, `/api/series`, `/api/editions`, `/api/partners`).

**Interfaces:**
- `POST /api/files?filename=` raw body (express.raw, limit 5 MB, types jpeg/png/webp) → 201 `{ id, filename, content_type, size }`; `GET /api/files/:id` → image bytes with its content type, `Cache-Control: private, max-age=3600`.
- Series JSON: `{ id, slug, name, label, short_name, tagline, description: string[], website, endorsement, audience, usual_venue, usual_month, cta_secondary, sort_order, active, edition_count }`.
- Edition JSON: `{ id, series_id, series_name, name, start_date, end_date, venue, description, rsvp_count, attendance, facebook_url, banner_file_id, status, outcome_notes }` (dates `YYYY-MM-DD`).
- Partner JSON: `{ id, name, role, series_id, edition_id, sort_order }`.
- Read = `events.read`; writes = `events.write`.

- [ ] Tests: each role can GET; only admin/events can POST/PATCH/DELETE (403 otherwise); slug must match `^[a-z0-9-]+$` and be unique (409 "That web address is already used by another series."); `end_date` before `start_date` → 400 field `end_date`; deleting a series with editions → 409 "Remove this series' editions first."; deleting a file used as a banner → 409; upload of `text/plain` → 400 "Upload a JPG, PNG or WebP image."; > 5 MB → 413 "Images must be 5 MB or smaller."; every write logs `create`/`update`/`delete` with a diff; `GET /api/editions?series_id=` filters and orders newest `start_date` first.
- [ ] Run → fail. Implement. Pass. Commit `feat: events API`.

### Task 3: Publish and public endpoints

**Files:** Create `server/src/publish/snapshot.ts`, `server/src/publish/routes.ts`, `server/src/public/routes.ts`, `server/src/public/cors.ts`, tests `server/src/publish/publish.test.ts`. Modify `server/src/app.ts` (mount `/api/public` before `requireAuth`; `/api/publish` after).

**Interfaces:**
- `buildSnapshot(db: Db): Promise<SiteSnapshot>` where `SiteSnapshot = { published_at: string; series: SiteSeries[]; events: SiteEvent[]; upcoming: SiteEvent[]; partners: {name, role}[] }`.
  - `SiteSeries` = site's `EventSeries` shape: `{ slug, name, shortName, series: label, tagline, description, website?, endorsement?, audience, usualVenue, usualMonth, partners: {name, role}[], ctaSecondary? }` (undefined optional fields omitted).
  - `SiteEvent` = site's `PastEvent` shape: `{ id, name, series: label, date, isoDate: start_date, venue, description, responded: rsvp_count ?? 0, image: '/api/public/files/<banner id>' | '', facebookUrl: facebook_url ?? '' }`.
  - `formatEventDate(start: string, end: string | null): string` → `'Tue, 12 May 2026'` (one day), `'24 – 27 Apr 2025'` (same month), `'30 Apr – 2 May 2025'` (different months), `'30 Dec 2025 – 2 Jan 2026'` (different years).
  - Active series in `sort_order`; editions of active series, non-cancelled, newest first; `partners` = all partners de-duplicated by name, roles joined with "; ".
- `POST /api/publish` (`events.publish`) → stores snapshot, logs `publish`, POSTs `{}` to `SITE_DEPLOY_HOOK_URL` if set (failure → response `deploy_hook: 'failed'`, publish still succeeds) → `{ published_at, series: n, events: n, deploy_hook: 'sent'|'failed'|'not_configured' }`. `GET /api/publish/latest` (`events.read`) → `{ published_at, published_by_name, counts }` or `null`.
- Public: `GET /api/public/site-data` → latest snapshot or 404 `{ error: 'Nothing published yet.' }`; `GET /api/public/files/:id` → only ids referenced in the latest snapshot, else 404. CORS: `Access-Control-Allow-Origin: PUBLIC_SITE_ORIGIN` (only when request Origin equals it), methods GET/POST/OPTIONS, header Content-Type.

- [ ] Tests: `formatEventDate` four cases; snapshot excludes inactive series and cancelled editions and lists upcoming separately; publish with nothing active → `series: 0, events: 0`; sales/finance → 403; public file not in snapshot → 404; CORS header present for allowed origin, absent for others; deploy hook called once with POST (inject `fetch` via `AppContext.fetch`, default global fetch).
- [ ] Implement (add `fetch` and `config: { publicSiteOrigin, deployHookUrl }` to `AppContext`, read from env in `index.ts`). Pass. Commit `feat: publishing and public site data`.

### Task 4: Admin Events and Publish sections

**Files:** Create `admin/src/lib/events.ts`, `admin/src/pages/EventsPage.tsx` (series list), `admin/src/pages/SeriesPage.tsx` (series editor + partners + editions list), `admin/src/pages/EditionPage.tsx` (edition editor + banner upload), `admin/src/pages/PublishPage.tsx`, `admin/src/components/ui.tsx` (shared `FIELD`, `PRIMARY`, `SECONDARY`, `Field`, `Notice`, `PageHeader`), tests `admin/src/pages/EventsPage.test.tsx`, `admin/src/pages/PublishPage.test.tsx`. Modify `admin/src/lib/permissions.ts` (nav items `events` all roles, `publish` admin+events), `AdminRoutes.tsx`, `components/Layout.tsx` icons, `test/fakeApi.ts` (events, files, publish handlers), `lib/types.ts`.

**Interfaces:** `admin/src/lib/events.ts`: `listSeries()`, `getSeries(id)`, `saveSeries(id|null, input)`, `deleteSeries(id)`, `listEditions(seriesId?)`, `getEdition(id)`, `saveEdition(id|null, input)`, `deleteEdition(id)`, `savePartner`, `deletePartner`, `uploadBanner(file: File): Promise<{id}>` (raw `fetch` POST to `/api/files?filename=`), `publish()`, `latestPublish()`; all return `Result`-style `{ ok, error }` for writes like `lib/staff.ts`.

- [ ] Tests: events role sees Events and Publish nav; sales sees Events read-only (no "Add series"/"Save" buttons, fields disabled); create a series → appears in list; edit an edition's attendance and outcome notes → PATCH body; banner upload rejects a `.txt` file client-side ("Upload a JPG, PNG or WebP image."); Publish page shows last publish time and counts, "Publish to website" confirms then shows "Published 4 series and 9 events."; delete series with editions shows the server's 409 message.
- [ ] Implement. `npm --prefix admin test|lint|build` pass. Commit `feat: admin events and publishing`.

### Task 5: Site uses published data

**Files:** Create `scripts/fetch-site-data.mjs`, `scripts/fetch-site-data.test.mjs`, `src/data/published.ts`. Modify `src/data/websiteData.ts` (use published series/events/partners when present), `src/types.ts` (`PastEvent.series: string`, `EventSeries.series: string`), `package.json` (`prebuild: node scripts/fetch-site-data.mjs`), `.gitignore` (`src/data/published.json`, `public/images/cms/`), `.env.example` (`VITE_ADMIN_API_URL`), README.

**Interfaces:**
- `fetchSiteData({ apiUrl, outFile, imageDir, fetch }): Promise<'written' | 'skipped' | 'failed'>` — no `apiUrl` → `'skipped'` (removes stale `published.json`); 404 → `'skipped'`; network/5xx → `'failed'` with warning, existing file left alone; otherwise downloads each `/api/public/files/<id>` to `public/images/cms/<id>.<ext>` and rewrites `image` to `/images/cms/<id>.<ext>`, writes JSON.
- `src/data/published.ts`: `export const PUBLISHED: SiteSnapshot | null` via `import.meta.glob('./published.json', { eager: true, import: 'default' })`.

- [ ] Tests: script cases above with a stub fetch and temp dir; site test that `EVENT_SERIES`/`PAST_EVENTS_DATA` equal built-in data when `PUBLISHED` is null (existing suite passes unchanged); `npm run build` passes with no `VITE_ADMIN_API_URL`.
- [ ] Implement. Site test/lint/build pass. Commit `feat: website builds from published event data`.

## Phase 3 — Enquiries

### Task 6: Enquiries schema, API and public endpoint

**Files:** `server/migrations/003_enquiries.sql`, `server/src/enquiries/routes.ts`, `server/src/public/enquiries.ts`, `server/src/public/rateLimit.ts`, tests `server/src/enquiries/enquiries.test.ts`.

**Interfaces:**
- Enquiry JSON: `{ id, created_at, full_name, company, email, phone, service, event, timeline, message, source, status, assignee_id, assignee_name, edition_id, edition_name, latest_note }`; detail adds `notes: { id, author_name, body, created_at }[]`.
- `GET /api/enquiries?status&source&assignee&q&from&to&page` (q matches name/company/email/phone, case-insensitive) → `{ rows, total }`, 50/page, newest first; `POST` (manual, source required, default `status='new'`); `GET/PATCH /:id` (status, assignee_id, edition_id, plus contact fields); `POST /:id/notes {body}` → 201. Guard `enquiries.access`.
- `POST /api/public/enquiries` body = site form `{ name, company, email, phone, service, event, timeline, message, botcheck }` → 201 `{ ok: true }`, stored with `source='website'`, logged with `actor_id null`; `botcheck` non-empty → 200 `{ ok: true }`, nothing stored; `RateLimiter(10, 60 min)` per `req.ip` → 429 "Too many enquiries from this connection. Try again later.". Requires `name` and (`email` or `phone`).

- [ ] Tests: role guard (events/finance 403); filters incl. Maldives-day `from`/`to`; status change logs diff; note logged; honeypot; rate limit at 11th; invalid email → 400 field `email`; assignee must be an active user (400 otherwise).
- [ ] Implement. Pass. Commit `feat: enquiries API and public enquiry endpoint`.

### Task 7: Admin Enquiries section and site form

**Files:** `admin/src/lib/enquiries.ts`, `admin/src/pages/EnquiriesPage.tsx`, `admin/src/pages/EnquiryPage.tsx`, tests; `src/pages/ContactPage.tsx` (or the form component it uses) + `src/lib/submitEnquiry.ts` with test; `.env.example` notes.

- [ ] Admin tests: list with status/source filters and search; "Add enquiry" form; detail changes status and assignee; add note appears with author and Maldives time; events role has no Enquiries nav.
- [ ] Site tests: when `VITE_ADMIN_API_URL` is set the form also POSTs to `<url>/api/public/enquiries` with the form fields and `botcheck`; a rejected/failed call never changes the visitor's success message; when unset no call is made.
- [ ] Implement. All suites pass. Commit `feat: enquiries in the admin app; website form records enquiries`.

## Phase 4 — Sponsors, deals and payments

### Task 8: Sponsors, deals and payments API

**Files:** `server/migrations/004_sales.sql`, `server/src/sales/routes.ts` (sponsors, deals, payments), `server/src/sales/money.ts`, tests `server/src/sales/sales.test.ts`.

**Interfaces:**
- `money` zod schema: accepts number or string matching `^\d+(\.\d{1,2})?$` after removing commas, > 0, ≤ 9,999,999,999.99 → "Enter an amount like 1500 or 1500.50.".
- Sponsor JSON `{ id, company, contact_name, email, phone, notes, created_at, deal_count }`; detail adds `deals`.
- Deal JSON `{ id, sponsor_id, sponsor_company, edition_id, edition_name, package, status, enquiry_id, notes, created_at, amount, currency, paid, outstanding }`; for roles without `deals.readAmounts` the keys `amount, currency, paid, outstanding, notes` are omitted. `GET /api/deals` also returns `totals: { currency, amount, paid, outstanding }[]` (confirmed + proposed only, cancelled excluded; omitted for events).
- Payment JSON `{ id, deal_id, amount, paid_on, method, invoice_no, notes, recorded_by_name, created_at }`.
- Guards: sponsors `sponsors.read/write`; deals `deals.read/write`; payments read `payments.read`, create `payments.write`, delete `payments.delete`. Payment on a cancelled deal → 409 "This deal is cancelled.".

- [ ] Tests: role × route; events JSON deep scan contains no `amount|paid|outstanding|currency` key anywhere in sponsors/deals responses; totals per currency never mixed; overpayment gives negative outstanding; amount parsing ("1,500.50" ok → 1500.5; "abc" → 400); deleting a payment logged; sponsor company unique case-insensitive (409).
- [ ] Implement. Pass. Commit `feat: sponsors, deals and payments API`.

### Task 9: Admin Sponsors, Deals and Payments

**Files:** `admin/src/lib/sales.ts`, `admin/src/pages/SponsorsPage.tsx`, `SponsorPage.tsx`, `DealsPage.tsx`, `DealPage.tsx` (payments inside), tests; nav: Sponsors (all), Deals (all).

- [ ] Tests: sales creates sponsor and deal; deals list shows totals per currency ("MVR 150,000.00"); finance records a payment and outstanding updates; sales sees payments but no "Record payment"; events sees deals without any amount column; admin deletes a payment after confirmation; overpaid shows "Overpaid by USD 50.00".
- [ ] Implement. Pass. Commit `feat: sponsors, deals and payments in the admin app`.

## Phase 5 — Reports and dashboard

### Task 10: Reports and dashboard API

**Files:** `server/src/reports/pdf.ts` (header/footer helpers), `server/src/reports/postEvent.ts`, `server/src/reports/sponsorship.ts`, `server/src/reports/enquiries.ts`, `server/src/reports/routes.ts`, `server/src/dashboard/routes.ts`, tests `server/src/reports/reports.test.ts`, `server/src/dashboard/dashboard.test.ts`. Dependencies `pdfkit`, `exceljs`, `@types/pdfkit`.

**Interfaces:** routes exactly as spec §6 Reports; responses with `Content-Disposition: attachment; filename="<name>.pdf|xlsx"`; each logs `export` with `{ report, filters }`. Dashboard `GET /api/dashboard` → `{ cards: { id, label, value }[] }` per spec §6 by role (value strings, money as "MVR 1,200.00").

- [ ] Tests: post-event PDF starts with `%PDF` and contains edition name; sponsorship XLSX parsed with exceljs has sheets `Deals` and `Payments`, frozen header, totals row per currency equals sum of confirmed+proposed amounts; enquiries XLSX row count = filtered enquiries; role guards per matrix; export logged; dashboard cards per role and events card list has no money.
- [ ] Implement. Pass. Commit `feat: reports and dashboard figures`.

### Task 11: Admin Reports and Dashboard; production serving

**Files:** `admin/src/pages/ReportsPage.tsx`, `admin/src/pages/DashboardPage.tsx`, tests; `server/src/app.ts` (in production serve `../admin/dist` with SPA fallback for non-`/api` paths, when the folder exists); README updates (sections, reports, publishing, site env).

- [ ] Tests: reports page lists only permitted reports per role and builds download links with filters; dashboard renders cards from API; server serves `index.html` for `/events` when `ADMIN_DIST` is set (test with temp dir).
- [ ] Implement. All suites + builds pass. Commit `feat: reports page, dashboard figures, production serving`.

### Task 12: Permission matrix sweep and end-to-end check

**Files:** `server/src/permissions.matrix.test.ts`.

- [ ] One table of every route (method, path, permission) × 4 roles; asserts 403 exactly when `can(role, permission)` is false. Pass. Commit `test: permission matrix across all routes`.
- [ ] Browser (1280 and 375): admin creates an edition with a banner, publishes; sales logs an enquiry, creates sponsor+deal; finance records payment; events sees deals without amounts and downloads post-event PDF; sales downloads sponsorship XLSX; site form submission appears in Enquiries. No console errors except expected 401s. Wipe test data afterwards.
