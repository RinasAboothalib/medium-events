# Online Promotion Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the MEDIUM site real, pre-rendered URLs with per-page search/share metadata, a working enquiry pipeline with WhatsApp fallback, and GA4 tracking.

**Architecture:** One route table (`src/routes.ts`) drives React Router (client), a build-time pre-render script (static HTML per route + sitemap/robots), and a build check. Lead capture and analytics live in small pure/fetch-injected modules under `src/lib/` that components call. Everything ships as static files for any host.

**Tech Stack:** Vite 8, React 19, TypeScript, Tailwind 4, `motion`, `react-router` v7 (declarative mode), Vitest + Testing Library + jsdom, Web3Forms, GA4 (gtag.js).

**Spec:** `docs/superpowers/specs/2026-10-12-online-promotion-foundation-design.md`

All paths below are relative to the project root `Medium--main/` (the folder containing `package.json`).

## Global Constraints

- Output must be static files only; no server runtime. Every route is pre-rendered to `dist/<path>/index.html` (`/` → `dist/index.html`).
- Routes: `/` Home, `/services` Services, `/events` Flagship Events, `/about` About & Credibility, `/news` Info Center, `/contact` Enquiry.
- Legacy hashes `home, services, events, about, info-center, enquiry` redirect (replace) to the routes above, only when pathname is `/`.
- `VITE_SITE_URL` default `https://medium.mv`, used without trailing slash.
- `VITE_WEB3FORMS_KEY` and `VITE_GA_ID` are optional; absence must never break the site.
- Web3Forms endpoint `https://api.web3forms.com/submit`; subject `New enquiry: <service>` or `New enquiry: <service> – <event>`; `from_name` `MEDIUM Website`; honeypot field `botcheck`.
- Event prefill selects the existing option `Flagship Expo Sponsorship / Booth`.
- WhatsApp number `+960 799-7974` (stored once in `COMPANY_DETAILS.whatsapp`); floating-button text `Hi MEDIUM, I'm interested in your events and services.`
- Success copy: `Thanks, {name}. MEDIUM will be in touch within 1 business day.` The fake `MED-xxxxxx` reference is removed.
- Share images: `/images/fb/cif-2025.jpg` for all routes except `/news` → `/images/fb/ooredoo-cif-2026-signing.jpg`.
- GA4 event names: `generate_lead`, `whatsapp_click`, `contact_click`, `facebook_event_click`.
- Visual design unchanged; no new UI beyond the WhatsApp button and form states.
- Do not remove unused deps (`@google/genai`, `express`).

## Review Focus

1. **Event names with `&`, `–`, `'`, `()` in `/contact?event=`** (e.g. `Aviation Forum – Connecting Maldives (AF)`) must round-trip exactly — test in Task 1 (`contactPath`) and Task 6 (form prefill).
2. **Opening or reloading `/contact?event=…` directly** (pre-rendered page, then hydration) must end with the prefill applied and no hydration crash — test in Task 6 renders at that URL.
3. **`VITE_SITE_URL` set with a trailing slash** (`https://medium.mv/`) must not produce `//` in canonical, og:url or sitemap — test in Task 2.
4. **Web3Forms returning a non-JSON error page or `{ success: false }` with HTTP 200** must be a failure that keeps the data and shows fallbacks, not a thrown error or false success — test in Task 5.
5. **Formatted phone numbers** (`+960 799-7974`) must become `9607997974` in `wa.me` links — test in Task 5.

---

### Task 0: Repo baseline and test runner

**Files:**
- Modify: `package.json` (scripts, devDependencies)
- Create: `vitest.config.ts`, `src/config.ts`, `src/config.test.ts`
- Modify: `.env.example`, `.gitignore`

**Interfaces:**
- Produces: `SITE_URL: string` (no trailing slash), `WEB3FORMS_KEY: string | undefined`, `GA_ID: string | undefined` exported from `src/config.ts`; `normalizeSiteUrl(raw: string | undefined): string`.

- [ ] **Step 1:** Only if the user approved `git init`: run `git init`, ensure `.gitignore` has `node_modules/`, `dist/`, `dist-ssr/`, `.env*` except `.env.example`; commit the current tree as `chore: baseline before promotion foundation`. Otherwise skip every commit step in this plan.
- [ ] **Step 2:** Install dev deps: `vitest`, `jsdom`, `@testing-library/react`. Pick the newest `vitest` whose `peerDependencies.vite` accepts Vite 8 (`npm view vitest peerDependencies`). Add script `"test": "vitest run"`.
- [ ] **Step 3:** `vitest.config.ts` — `environment: 'jsdom'`, plugins `react()`, `include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs']`.
- [ ] **Step 4: Write failing test** `src/config.test.ts`:

```ts
expect(normalizeSiteUrl(undefined)).toBe('https://medium.mv');
expect(normalizeSiteUrl('https://medium.mv/')).toBe('https://medium.mv');
expect(normalizeSiteUrl('https://staging.example.com//')).toBe('https://staging.example.com');
```

- [ ] **Step 5:** Run `npm test` → FAIL (module missing).
- [ ] **Step 6:** Implement `src/config.ts` reading `import.meta.env.VITE_SITE_URL / VITE_WEB3FORMS_KEY / VITE_GA_ID`; empty strings count as unset.
- [ ] **Step 7:** Run `npm test` → PASS. Add the three vars with comments to `.env.example` (keep existing entries).
- [ ] **Step 8:** Commit `chore: add vitest and site config`.

### Task 1: Route table, paths and legacy hash mapping

**Files:**
- Create: `src/routes.ts`, `src/routes.test.ts`

**Interfaces:**
- Produces:
  - `type PageId = 'home' | 'services' | 'events' | 'about' | 'news' | 'contact'`
  - `interface RouteMeta { id: PageId; path: string; navLabel: string; title: string; description: string; ogImage: string }`
  - `ROUTES: RouteMeta[]` (order = nav order: Home, Services, Flagship Events, About & Credibility, Info Center, Enquiry — reuse current Navbar labels)
  - `pathFor(id: PageId): string`
  - `routeForPath(pathname: string): RouteMeta | undefined` (tolerates trailing slash)
  - `contactPath(opts?: { service?: string; event?: string }): string`
  - `legacyHashToPath(hash: string): string | null` (accepts with or without leading `#`)

- [ ] **Step 1: Write failing tests:**

```ts
expect(ROUTES.map(r => r.path)).toEqual(['/', '/services', '/events', '/about', '/news', '/contact']);
expect(new Set(ROUTES.map(r => r.title)).size).toBe(ROUTES.length);
expect(ROUTES.find(r => r.id === 'news')!.ogImage).toBe('/images/fb/ooredoo-cif-2026-signing.jpg');
expect(routeForPath('/events/')!.id).toBe('events');
expect(legacyHashToPath('#info-center')).toBe('/news');
expect(legacyHashToPath('enquiry')).toBe('/contact');
expect(legacyHashToPath('#nope')).toBeNull();
expect(legacyHashToPath('')).toBeNull();
const p = contactPath({ event: 'Aviation Forum – Connecting Maldives (AF) & more' });
expect(new URL(p, 'https://x').searchParams.get('event')).toBe('Aviation Forum – Connecting Maldives (AF) & more');
expect(contactPath()).toBe('/contact');
```

- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement. Titles follow `<Page> | MEDIUM Events Maldives` (Home: `MEDIUM Events | Expos, Forums & Creative Agency in the Maldives`). Write one specific description per page (≤160 chars) using facts from `websiteData.ts`. Use `URLSearchParams` in `contactPath`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: add route table and legacy hash mapping`.

### Task 2: SEO builders (head tags, structured data, sitemap)

**Files:**
- Create: `src/seo/headTags.ts`, `src/seo/structuredData.ts`, `src/seo/sitemap.ts`, `src/seo/seo.test.ts`

**Interfaces:**
- Consumes: `RouteMeta`, `ROUTES` (Task 1); `COMPANY_DETAILS`, `PAST_EVENTS_DATA` (`src/data/websiteData.ts`).
- Produces:
  - `buildHeadTags(route: RouteMeta, siteUrl: string, jsonLd: object[]): string` — HTML string for `<head>`
  - `organizationJsonLd(siteUrl: string): object`
  - `pastEventsJsonLd(siteUrl: string): object[]`
  - `jsonLdForRoute(route: RouteMeta, siteUrl: string): object[]` — Organization always; plus past events when `route.id === 'events'`
  - `buildSitemap(routes: RouteMeta[], siteUrl: string): string`
  - `buildRobots(siteUrl: string): string`
- All functions normalize `siteUrl` via `normalizeSiteUrl` (Task 0).

- [ ] **Step 1: Write failing tests:**

```ts
const events = ROUTES.find(r => r.id === 'events')!;
const head = buildHeadTags(events, 'https://medium.mv/', jsonLdForRoute(events, 'https://medium.mv'));
expect(head).toContain('<link rel="canonical" href="https://medium.mv/events">');
expect(head).toContain('<meta property="og:image" content="https://medium.mv/images/fb/cif-2025.jpg">');
expect(head).toContain('<meta name="twitter:card" content="summary_large_image">');
expect(head).not.toMatch(/https:\/\/medium\.mv\/\//);
expect(buildHeadTags(ROUTES[0], 'https://medium.mv', [])).toContain('href="https://medium.mv/"');
// escaping
expect(buildHeadTags({ ...events, title: 'A & "B" <C>' }, 'https://medium.mv', [])).toContain('A &amp; &quot;B&quot; &lt;C&gt;');
const org = organizationJsonLd('https://medium.mv') as any;
expect(org['@type']).toBe('Organization');
expect(org.sameAs).toEqual([COMPANY_DETAILS.social.facebook, COMPANY_DETAILS.social.instagram, COMPANY_DETAILS.social.linkedin]);
const evs = pastEventsJsonLd('https://medium.mv') as any[];
expect(evs).toHaveLength(PAST_EVENTS_DATA.length);
expect(evs[0]).toMatchObject({ '@type': 'Event', startDate: PAST_EVENTS_DATA[0].isoDate, eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode' });
expect(jsonLdForRoute(ROUTES[0], 'https://medium.mv')).toHaveLength(1);
const sm = buildSitemap(ROUTES, 'https://medium.mv/');
expect(sm.match(/<loc>/g)).toHaveLength(6);
expect(sm).toContain('<loc>https://medium.mv/news</loc>');
expect(buildRobots('https://medium.mv')).toContain('Sitemap: https://medium.mv/sitemap.xml');
```

- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement. `buildHeadTags` emits the tag list in spec §3 (title, description, canonical, og:title/description/url/type=website/image/image:width/image:height/site_name=`MEDIUM Events`, twitter card/title/description/image) plus one `<script type="application/ld+json">` per object (serialize with `JSON.stringify(...).replace(/</g, '\\u003c')`). og:image width/height from a small map: `cif-2025.jpg` 960×453, `ooredoo-cif-2026-signing.jpg` 2048×1365. Organization: name, url, logo (`{siteUrl}/images/fb/cif-2025.jpg` until a logo file exists), address (`PostalAddress`, streetAddress `Champa Building 4, 5th Floor, Orchid Magu`, addressLocality `Malé`, addressCountry `MV`), telephone `[phone, secondaryPhone, officePhone]`, email `inquiryEmail`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: add SEO head, JSON-LD and sitemap builders`.

### Task 3: Router migration (pages, layout, navigation, prefill via URL)

**Files:**
- Create: `src/pages/HomePage.tsx`, `ServicesPage.tsx`, `EventsPage.tsx`, `AboutPage.tsx`, `NewsPage.tsx`, `ContactPage.tsx`; `src/AppRoutes.tsx`; `src/hooks/usePageMeta.ts`; `src/AppRoutes.test.tsx`
- Modify: `src/App.tsx` (becomes layout), `src/main.tsx`, `src/components/Navbar.tsx`, `Footer.tsx`, `Hero.tsx`, `ServicesSection.tsx`, `EventsSection.tsx`, `EventModal.tsx`, `NewsSection.tsx`, `NewsModal.tsx`, `PastEventsSection.tsx`, `EnquiryForm.tsx` (props only)
- Add dep: `react-router` (v7)

**Interfaces:**
- Consumes: `ROUTES`, `pathFor`, `routeForPath`, `contactPath`, `legacyHashToPath` (Task 1).
- Produces:
  - `AppRoutes(): JSX.Element` — `<Routes>` with layout `App` and the six pages; unknown paths render `HomePage` (no 404 page in scope). Used by both `main.tsx` (inside `BrowserRouter`) and `entry-server.tsx` (inside `StaticRouter`, Task 4).
  - `usePageMeta(): void` — sets `document.title` from `routeForPath(location.pathname)` on change.
  - `EnquiryForm` takes no props; reads `service`/`event` from `useSearchParams()` **inside a `useEffect`** (initial render must match the pre-rendered HTML).
  - Removed props: `onNavigate` (Navbar, Footer, Hero), `onSelectService`, `onEnquireEvent`/`onEnquire`, `prefilledService`/`prefilledEvent`; `PastEventsSection` keeps `limit` and replaces `onViewAll` with an internal link to `/events`.

- [ ] **Step 1: Write failing tests** in `src/AppRoutes.test.tsx` rendering `<MemoryRouter initialEntries={[url]}><AppRoutes/></MemoryRouter>`:
  - `/events` → heading `Nation-Scale Expos & Strategic Forums` and `Events We've Delivered` present.
  - `/news` → heading `News, Expo Bulletins & Press Releases`.
  - `/` with entry `/#events` → after effects, location pathname is `/events` (assert via a `useLocation` probe component).
  - `/about#events` → stays `/about`.
  - Navbar link `Info Center` has `href="/news"`; Footer link `Project Enquiry` has `href="/contact"`.
  - On `/events`, the first flagship card's `Sponsorship` control has `href` equal to `contactPath({ event: FLAGSHIP_EVENTS_DATA[0].name })`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Move each `activeSection === '<id>'` block of the current `App.tsx` into its page component (keep markup and the `pt-20` wrappers). `HomePage` and `EventsPage` own the marquee `EventModal` state (current `handleMarqueeSelect` logic). Home "Explore MEDIUM" cards become `Link`s.
- [ ] **Step 4:** `App.tsx` becomes the layout: `ScrollProgress`, `Navbar`, `<main>` with the existing `AnimatePresence`/`motion.div` keyed by `location.pathname` wrapping `<Outlet/>`, `Footer`. Effects: scroll to top on pathname change; legacy hash redirect via `legacyHashToPath` when pathname is `/`; `usePageMeta()`.
- [ ] **Step 5:** Convert components: navigation buttons → `Link to={pathFor(...)}` (keep classNames); Navbar active state from `useLocation()` + `routeForPath`, closes mobile menu on click; event/service CTAs → `Link to={contactPath({ event | service })}`; modal CTAs call `onClose()` then `navigate(contactPath(...))`.
- [ ] **Step 6:** `EnquiryForm`: drop props; effect applies `service` (match `SERVICES_DATA` id → title) or `event` (select `Flagship Expo Sponsorship / Booth`, message `Inquiry regarding sponsorship / exhibition participation for: {event}.`).
- [ ] **Step 7:** `main.tsx`: `<BrowserRouter><AppRoutes/></BrowserRouter>`; keep `createRoot` for now (hydration is Task 4).
- [ ] **Step 8:** `npm test` → PASS; `npm run lint` → no errors.
- [ ] **Step 9:** `npx vite` and click through all six pages, the hash link `/#events`, and an event `Sponsorship` button → `/contact` shows the sponsorship option and message.
- [ ] **Step 10:** Commit `feat: migrate to real routes with react-router`.

### Task 4: Pre-render pipeline and build check

**Files:**
- Create: `src/entry-server.tsx`, `scripts/prerender.mjs`, `scripts/check-build.mjs`, `scripts/check-build.test.mjs`
- Modify: `index.html`, `src/main.tsx`, `package.json` (build script), `.gitignore` (`dist-ssr/`)

**Interfaces:**
- Consumes: `AppRoutes` (Task 3); `ROUTES`, `buildHeadTags`, `jsonLdForRoute`, `buildSitemap`, `buildRobots`, `SITE_URL` (Tasks 0–2) — re-exported from `entry-server.tsx` so the script imports one bundle.
- Produces:
  - `render(url: string): string` from `src/entry-server.tsx` (`renderToString(<StaticRouter location={url}><AppRoutes/></StaticRouter>)`).
  - `checkBuild(distDir: string, routes: {path:string}[]): string[]` from `scripts/check-build.mjs` — returns a list of problems (empty = pass); CLI exits 1 when non-empty.
  - Build script: `"build": "vite build && vite build --ssr src/entry-server.tsx --outDir dist-ssr && node scripts/prerender.mjs && node scripts/check-build.mjs"`.

- [ ] **Step 1: Write failing test** `scripts/check-build.test.mjs` using a temp dir: a valid `index.html` + `about/index.html` → `[]`; a page missing `og:image` → one problem naming that path; two pages with the same `<title>` → a problem; empty `<div id="root"></div>` → a problem; missing `sitemap.xml` → a problem.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement `checkBuild` (string/regex checks are fine; `og:image` must start with `http`).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** `index.html`: remove the hard-coded title/description/og/twitter tags, put `<!--app-head-->` in `<head>`, and `<div id="root"><!--app-html--></div>`. Keep fonts and favicon.
- [ ] **Step 6:** `main.tsx`: `hydrateRoot` when `#root` has element children, else `createRoot(...).render`.
- [ ] **Step 7:** `scripts/prerender.mjs`: read `dist/index.html` once as template; import `dist-ssr/entry-server.js`; for each route write `dist/<path>/index.html` with head and html substituted; write `dist/sitemap.xml`, `dist/robots.txt`. Read `VITE_SITE_URL` via `normalizeSiteUrl(process.env.VITE_SITE_URL)` (Vite does not inject env into Node scripts — load `.env` with Vite's `loadEnv` or the existing `dotenv` dep).
- [ ] **Step 8:** `npm run build` → completes, prints no check problems; `dist/events/index.html` contains `Events We've Delivered` and its canonical.
- [ ] **Step 9:** Serve `dist/` (`npx vite preview --port 3006`), load `/events` and `/contact?event=Build%20Expo` directly; console has no hydration errors; prefill applied.
- [ ] **Step 10:** Commit `feat: pre-render every route with per-page SEO`.

### Task 5: Enquiry delivery library

**Files:**
- Create: `src/lib/enquiry.ts`, `src/lib/enquiry.test.ts`
- Modify: `src/types.ts` (`EnquirySubmission` gains optional `event?: string`), `src/data/websiteData.ts` (`COMPANY_DETAILS.whatsapp: '+960 799-7974'`)

**Interfaces:**
- Produces:
  - `type SubmitResult = { ok: true } | { ok: false; reason: 'network' | 'rejected' }`
  - `submitEnquiry(data: EnquirySubmission, key: string, pageUrl: string, fetchImpl?: typeof fetch): Promise<SubmitResult>`
  - `enquirySubject(data: EnquirySubmission): string`
  - `formatEnquiryText(data: EnquirySubmission): string`
  - `toWaNumber(phone: string): string`
  - `buildWhatsAppUrl(phone: string, text: string): string`
  - `buildMailtoUrl(to: string, subject: string, body: string): string`

- [ ] **Step 1: Write failing tests** (fetch is a `vi.fn`):

```ts
const data = { fullName: 'Aisha', company: 'Co', email: 'a@b.mv', phone: '7771234', service: 'Flagship Expo Sponsorship / Booth', timeline: 'Q3/Q4 2026', budget: '', message: 'Booth please', event: 'Build Expo' };
expect(enquirySubject(data)).toBe('New enquiry: Flagship Expo Sponsorship / Booth – Build Expo');
expect(enquirySubject({ ...data, event: undefined })).toBe('New enquiry: Flagship Expo Sponsorship / Booth');
// success
const ok = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })));
expect(await submitEnquiry(data, 'KEY', 'https://medium.mv/contact', ok)).toEqual({ ok: true });
const body = JSON.parse(ok.mock.calls[0][1].body);
expect(ok.mock.calls[0][0]).toBe('https://api.web3forms.com/submit');
expect(body).toMatchObject({ access_key: 'KEY', from_name: 'MEDIUM Website', botcheck: false, name: 'Aisha', event: 'Build Expo', page: 'https://medium.mv/contact' });
// rejected
expect(await submitEnquiry(data, 'KEY', '', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false }))))).toEqual({ ok: false, reason: 'rejected' });
expect(await submitEnquiry(data, 'KEY', '', vi.fn().mockResolvedValue(new Response('<html>502</html>', { status: 502 })))).toEqual({ ok: false, reason: 'rejected' });
// network
expect(await submitEnquiry(data, 'KEY', '', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))).toEqual({ ok: false, reason: 'network' });
// links
expect(toWaNumber('+960 799-7974')).toBe('9607997974');
expect(buildWhatsAppUrl('+960 799-7974', "Hi & 'hello'")).toBe('https://wa.me/9607997974?text=' + encodeURIComponent("Hi & 'hello'"));
expect(buildMailtoUrl('info@medium.mv', 'S & T', 'line1\nline2')).toBe('mailto:info@medium.mv?subject=S%20%26%20T&body=line1%0Aline2');
for (const v of ['Aisha', 'Co', 'a@b.mv', '7771234', 'Build Expo', 'Booth please']) expect(formatEnquiryText(data)).toContain(v);
```

- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement. Payload keys: `access_key, subject, from_name, botcheck, name, company, email, phone, service, timeline, budget, message, event, page`. Any non-JSON body or `success !== true` → `rejected`; thrown fetch → `network`. Use `encodeURIComponent` for mailto parts (not `URLSearchParams`, which encodes spaces as `+`).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: add enquiry delivery and contact link helpers`.

### Task 6: Enquiry form states and fallbacks

**Files:**
- Modify: `src/components/EnquiryForm.tsx`
- Create: `src/components/EnquiryForm.test.tsx`

**Interfaces:**
- Consumes: `submitEnquiry`, `enquirySubject`, `formatEnquiryText`, `buildWhatsAppUrl`, `buildMailtoUrl` (Task 5); `WEB3FORMS_KEY` (Task 0) — read through a module the test can mock (`vi.mock('../config')`).
- Produces: form states `idle | sending | sent | failed`; no props.

- [ ] **Step 1: Write failing tests** (render in `MemoryRouter`, fill required fields with `fireEvent.change`):
  - No key → submit button text `Send via WhatsApp`; a `Send by email` link has `href` starting `mailto:info@medium.mv?subject=New%20enquiry`.
  - With key, fetch resolves `{ success: true }` → text `Thanks, Aisha. MEDIUM will be in touch within 1 business day.`; no text matching `/MED-\d{6}/`.
  - With key, fetch rejects → message field still contains typed text; links `Send on WhatsApp instead` (`href` starts `https://wa.me/9607997974?text=`) and `Send by email instead` are visible.
  - Rendered at `/contact?event=Aviation%20Forum%20%E2%80%93%20Connecting%20Maldives%20(AF)` → service select value `Flagship Expo Sponsorship / Booth`; message contains `Aviation Forum – Connecting Maldives (AF)`.
  - Honeypot input named `botcheck` exists and is not visible to users (`aria-hidden`/`tabIndex=-1`, visually hidden class).
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement on the existing markup: keep validation; remove the 900 ms simulation and reference id; sending → spinner + disabled fields; failed → inline panel (reuse `AlertCircle` styling) with the two fallback links; no-key mode replaces submit with WhatsApp primary + email secondary (both built from current form data, validation still runs first). Keep the enquiry's `event` from the URL in form state so it reaches the subject/payload.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Browser check on `/contact` at 375px and desktop: all states reachable (temporarily set a bogus key in `.env.local` to see `failed`).
- [ ] **Step 6:** Commit `feat: deliver enquiries via Web3Forms with WhatsApp/email fallback`.

### Task 7: Floating WhatsApp button

**Files:**
- Create: `src/components/WhatsAppButton.tsx`, `src/components/WhatsAppButton.test.tsx`
- Modify: `src/App.tsx` (render in layout)

**Interfaces:**
- Consumes: `buildWhatsAppUrl` (Task 5), `COMPANY_DETAILS.whatsapp`.
- Produces: `WhatsAppButton(): JSX.Element` with optional `onClick` hook point used by Task 8.

- [ ] **Step 1: Write failing test:** link with accessible name `Chat with MEDIUM on WhatsApp`, `href === buildWhatsAppUrl('+960 799-7974', "Hi MEDIUM, I'm interested in your events and services.")`, `target="_blank"`, `rel` contains `noopener`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement: fixed `bottom-5 right-5`, round green (`#25D366`) button with WhatsApp glyph (inline SVG; lucide has no brand icon), `z-40` (below modals at `z-50`). On `/contact`, raise it (`bottom-24` on mobile) so it never covers the submit button.
- [ ] **Step 4:** `npm test` → PASS; visual check at 375px on `/contact` and `/`.
- [ ] **Step 5:** Commit `feat: add floating WhatsApp chat button`.

### Task 8: GA4 analytics

**Files:**
- Create: `src/lib/analytics.ts`, `src/lib/analytics.test.ts`
- Modify: `src/App.tsx` (init + page views), `EnquiryForm.tsx`, `WhatsAppButton.tsx`, `Navbar.tsx`, `Footer.tsx`, `PastEventsSection.tsx` (event calls)

**Interfaces:**
- Consumes: `GA_ID` (Task 0).
- Produces:
  - `initAnalytics(id: string | undefined): void` — no-op when id unset or `typeof window === 'undefined'`; injects `https://www.googletagmanager.com/gtag/js?id=<id>` once, defines `window.dataLayer`/`gtag`, `gtag('config', id, { send_page_view: false })`.
  - `trackPageView(path: string, title: string): void`
  - `trackEvent(name: 'generate_lead' | 'whatsapp_click' | 'contact_click' | 'facebook_event_click', params: Record<string, string>): void` — no-op before init.

- [ ] **Step 1: Write failing tests:** with id `undefined` → no `<script>` added and `trackEvent` does not throw; with `'G-TEST'` → exactly one script whose `src` ends `id=G-TEST` even if called twice; after init, `trackEvent('whatsapp_click', { location: 'floating' })` pushes `['event', 'whatsapp_click', { location: 'floating' }]` onto `window.dataLayer` (gtag pushes `arguments`; compare with `Array.from`).
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement and wire: layout calls `initAnalytics(GA_ID)` once and `trackPageView` on pathname change; `generate_lead {service, event}` only after `submitEnquiry` returns ok; `whatsapp_click {location: 'floating' | 'form' | 'fallback'}`; `contact_click {method: 'phone' | 'email'}` on `tel:`/`mailto:` links in Navbar/Footer/contact details; `facebook_event_click {event_id}` on PastEventsSection "View Event".
- [ ] **Step 4:** `npm test` → PASS; `npm run lint` → clean.
- [ ] **Step 5:** Commit `feat: add GA4 page view and lead tracking`.

### Task 9: Final verification

- [ ] **Step 1:** `npm run lint && npm test && npm run build` → all pass, build check reports no problems.
- [ ] **Step 2:** `npx vite preview --port 3006`; in the browser at desktop and 375px: visit all six routes directly, `/#events` and `/#enquiry` redirects, event `Sponsorship` → prefilled `/contact`, home marquee modal, PastEvents "View Full Track Record", WhatsApp button, form no-key mode. Console: no errors.
- [ ] **Step 3:** View source of `/news`: unique title, canonical `https://medium.mv/news`, og:image Ooredoo photo, Organization JSON-LD. `/sitemap.xml` lists 6 URLs; `/robots.txt` references it.
- [ ] **Step 4:** Add a short `README.md` section "Deploying & configuration": the three env vars, `npm run build` → upload `dist/`, Medium's three actions (Web3Forms key, GA4 ID, Search Console sitemap), Facebook Sharing Debugger check.
- [ ] **Step 5:** Commit `docs: deployment and configuration notes`.
