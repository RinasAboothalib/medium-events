# International Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle and rewrite the MEDIUM site in the corporate-expo direction, add four event series pages, and remove every unverified claim — without regressing round one (routes, pre-rendering, SEO, enquiry delivery, WhatsApp, GA4).

**Architecture:** A palette in Tailwind `@theme` tokens plus a small set of UI primitives (`src/components/ui/`) that every page is rebuilt from. Event series are data (`EVENT_SERIES`) linked to `PAST_EVENTS_DATA`; the route table gains one route per series, so pre-rendering, sitemap, SEO and build check extend automatically. Old components are deleted only after their replacements exist.

**Tech Stack:** Vite 8, React 19, TypeScript, Tailwind 4 (`@theme`), react-router v7, motion, lucide-react, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-12-international-redesign-design.md` (read it; it holds the palette, page sections and copy rules). Branch: `feat/international-redesign`. Paths are relative to `Medium--main/`.

## Global Constraints

- Palette (exact): brand `#12229D`, brand-hover `#0E1A7A`, brand-tint `#EEF0FB`, ink `#101828`, body `#475467`, muted `#667085`, line `#E4E7EC`, surface `#F8FAFC`, footer `#0A1240`, on-brand-muted `#C7CCF5`.
- No gradients, glows, glass/blur, gold/yellow accents, marquees, scale-on-hover, scroll progress bar.
- One primary button per section; focus-visible ring 2px brand with 2px offset on every interactive element.
- British English; sentence-case headings; banned words in copy: nation-scale, executive overview, mandate, indelible, paramount, curate, bespoke.
- Only verified facts (Facebook events/posts, medium.mv, event banners). Never re-add: HOSCO, Marine Expo, 12,000, Visiting Guide, Maldives Publications, 100+ turnkey, Ministry of Transport, Civil Aviation Authority, Regional Airlines Alliance, Indian Ocean Divers, NBAM.
- Main nav labels/paths: Home `/`, Events `/events`, Services `/services`, About `/about`, News `/news`, Contact `/contact`; header button "Become a sponsor" → `contactPath({ service: 'sponsorship' })`.
- Series slugs: `construction-industry-forum`, `marine-industry-forum`, `aviation-forum`, `build-expo`.
- Home H1 "Meet the Maldives' construction, marine and aviation leaders." and the intro/sponsor-band copy in spec §4 are exact.
- Round-one behaviour kept: legacy hash redirects, enquiry states and fallbacks, honeypot, timeout, floating WhatsApp (hidden on `/contact`), GA4 events, per-page head tags, both `x.html` and `x/index.html` output.

## Review Focus

1. **Series names with `–`** ("Aviation Forum – Connecting Maldives") flowing through the series CTA into `/contact?event=` must prefill the form and appear exactly in the email subject — test in Task 5.
2. **Unknown or trailing-slash series URLs** (`/events/nope`, `/events/build-expo/`) must not crash: trailing slash renders the series page; unknown slug renders the Events page — test in Task 5.
3. **Mobile menu** must close after choosing a link and expose "Become a sponsor" — test in Task 4.
4. **Single-edition series** (Build Expo) must read "1 edition", not "1 editions" — test in Task 5.
5. **Active nav state on series pages** — "Events" marked `aria-current="page"` at `/events/build-expo` — test in Task 4.

---

### Task 0: Palette tokens and contrast guard

**Files:** Create `src/design/palette.ts`, `src/design/contrast.ts`, `src/design/palette.test.ts`; Modify `src/index.css`.

**Interfaces — Produces:**
- `PALETTE: Record<'brand'|'brandHover'|'brandTint'|'ink'|'body'|'muted'|'line'|'surface'|'footer'|'onBrandMuted'|'white', string>`
- `TEXT_PAIRS: { fg: keyof typeof PALETTE; bg: keyof typeof PALETTE; large?: boolean }[]`
- `contrastRatio(fgHex: string, bgHex: string): number` (WCAG 2.1 relative luminance)
- Tailwind colours: `bg-brand`, `text-ink`, `border-line`, `bg-surface`, `bg-footer`, `text-on-brand-muted`, etc. via `@theme { --color-brand: #12229D; ... }`.

- [ ] **Step 1: Failing tests** — `contrastRatio('#000000','#FFFFFF')` ≈ 21 (toBeCloseTo 0); `contrastRatio('#FFFFFF','#FFFFFF')` = 1; every `TEXT_PAIRS` entry ≥ 4.5 (≥ 3 if `large`). Pairs: ink/white, body/white, body/surface, muted/white, muted/surface, brand/white, white/brand, onBrandMuted/brand, white/footer, onBrandMuted/footer, brand/brandTint, white/brandHover.
- [ ] **Step 2:** `npx vitest run src/design` → FAIL (module missing).
- [ ] **Step 3:** Implement; add `@theme` colour tokens to `src/index.css` mirroring `PALETTE` (keep existing classes for now; removed in Task 10).
- [ ] **Step 4:** `npx vitest run` → all pass. If a pair fails, stop and report — palette values are fixed by the spec.
- [ ] **Step 5:** Commit `feat: add corporate palette tokens with contrast guard`.

### Task 1: UI primitives

**Files:** Create `src/components/ui/{Container,Section,SectionHeader,Button,Card,StatStrip,PartnerStrip,CtaBand,PageHeader,FadeIn}.tsx`, `src/components/ui/index.ts`, `src/components/ui/ui.test.tsx`.

**Interfaces — Produces** (all exported from `ui/index.ts`):
- `Container({ children, className? })`
- `Section({ tone?: 'white'|'surface'|'brand', id?, children, className? })`
- `SectionHeader({ eyebrow?, title, intro?, align?: 'left'|'center', as?: 'h1'|'h2' })`
- `Button({ variant?: 'primary'|'secondary', to?: string, href?: string, onClick?, children, className?, external?: boolean })` — `to` → router `Link`; `href` → `<a>` (`target="_blank" rel="noopener noreferrer"` when `external`).
- `Card({ to?, href?, children, className? })` — renders `Link`/`<a>`/`<div>`.
- `StatStrip({ stats: { value: string; label: string }[] })`
- `PartnerStrip({ partners: { name: string; role: string }[], title?: string })`
- `CtaBand({ title, text?, primary: { label, to }, secondary?: { label, to } })`
- `PageHeader({ eyebrow?, title, intro?, children? })` — renders the page's single `h1`.
- `FadeIn({ children, delay? })` — motion `whileInView` once, opacity 0→1 + y 8→0, ≤ 400ms.

- [ ] **Step 1: Failing tests** — `Button to="/events"` renders `<a href="/events">` without target; `Button href="https://cif.mv" external` has `target="_blank"` and `rel` containing `noopener`; `Button variant="primary"` has class `bg-brand`; `Section tone="brand"` has class `bg-brand`; `PageHeader title="X"` renders exactly one `h1` "X"; `StatStrip` renders each value and label; `CtaBand` primary link `href` equals its `to`.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** Implement with Tailwind palette classes; focus ring `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand`; cards hover `hover:border-brand`, no transforms.
- [ ] **Step 4:** `npx vitest run` → pass; `npm run lint` clean.
- [ ] **Step 5:** Commit `feat: add corporate UI primitives`.

### Task 2: Event series data and verified content

**Files:** Modify `src/types.ts`, `src/data/websiteData.ts`; Create `src/data/series.test.ts`.

**Interfaces — Produces:**
- `interface EventSeries { slug: string; name: string; shortName: string; series: PastEvent['series']; tagline: string; description: string[]; website?: string; endorsement?: string; audience: string; usualVenue: string; usualMonth: string; partners: { name: string; role: string }[]; ctaSecondary?: string }`
- `EVENT_SERIES: EventSeries[]`, `editionsFor(series: PastEvent['series']): PastEvent[]` (newest first), `seriesBySlug(slug: string): EventSeries | undefined`, `SITE_STATS: { value: string; label: string }[]`, `VERIFIED_PARTNERS: { name: string; role: string }[]`.
- Service option: `SERVICE_OPTIONS: { id: string; label: string }[]` with `{ id: 'sponsorship', label: 'Sponsorship or exhibition stand' }` replacing "Flagship Expo Sponsorship / Booth"; existing four service ids map to their current labels; plus `{ id: 'general', label: 'General enquiry' }`.

Series values (exact; `description` written from the Facebook event descriptions in `PAST_EVENTS_DATA`/spec, 2 short paragraphs):

| slug | name | shortName | website | endorsement | audience | usualVenue | usualMonth | partners | ctaSecondary |
|---|---|---|---|---|---|---|---|---|---|
| construction-industry-forum | Construction Industry Forum | CIF | https://cif.mv | Endorsed by MNACI | Government and private-sector decision makers in building and construction | Malé and Hulhumalé | August–September | MNACI — Endorsing association; Ooredoo Maldives — Exclusive Platinum Sponsor, CIF 2026 | — |
| marine-industry-forum | Maldives Marine Industry Forum | MMIF | https://mmif.mv | — | Marine industry leaders from government and the private sector | JEN Malé Maldives by Shangri-La | May–July | — | — |
| aviation-forum | Aviation Forum – Connecting Maldives | Aviation Forum | https://aviationforum.mv | — | Government officials and private-sector aviation leaders | JEN Malé Maldives by Shangri-La | April–May | SITA — Sponsor, Aviation Forum 2026 | — |
| build-expo | Build Expo | Build Expo | — | Official exhibition of MNACI | Contractors, suppliers, developers and the public | Central Park, Hulhumalé | April | MNACI — Official exhibition partner | Book a stand |

`SITE_STATS` derived: `[{ value: String(PAST_EVENTS_DATA.length), label: 'events hosted' }, { value: String(EVENT_SERIES.length), label: 'event series' }, { value: <earliest isoDate year>, label: 'first forum' }, { value: '60+', label: 'years combined experience' }]`.

- [ ] **Step 1: Failing tests** — 4 unique slugs equal to the Global Constraints list; every `PAST_EVENTS_DATA[i].series` is some `EVENT_SERIES[j].series`; each series has ≥ 1 edition; `editionsFor('Construction Industry Forum').map(e => e.id)` equals `['cif-2025','cif-2024','cif-2023']`; `seriesBySlug('build-expo')!.ctaSecondary === 'Book a stand'`; `SITE_STATS` equals `[{value:'9',...},{value:'4',...},{value:'2023',...},{value:'60+',...}]`; `SERVICE_OPTIONS` contains `{ id: 'sponsorship', label: 'Sponsorship or exhibition stand' }`.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** Implement additions only — do not delete `FLAGSHIP_EVENTS_DATA`, `CLIENT_PARTNERS` or old news yet (Task 10). Rewrite `SERVICES_DATA` copy to British English, plain voice, from medium.mv wording (titles: Events, Advertising, Design and production, Creative consultancy; keep ids).
- [ ] **Step 4:** `npx vitest run` → pass (update `enquiry.test.ts`/`EnquiryForm.test.tsx` only if they break — they shouldn't yet).
- [ ] **Step 5:** Commit `feat: add event series data and verified site stats`.

### Task 3: Series routes and SEO

**Files:** Modify `src/routes.ts`, `src/routes.test.ts`, `src/seo/structuredData.ts`, `src/seo/seo.test.ts`.

**Interfaces — Consumes:** `EVENT_SERIES`, `editionsFor` (Task 2). **Produces:**
- `PageId` = main ids | `` `series-${string}` ``; `RouteMeta` gains `kind: 'main' | 'series'` and optional `seriesSlug`.
- `MAIN_ROUTES: RouteMeta[]` (the 6, nav order) and `ROUTES = [...MAIN_ROUTES, ...seriesRoutes]`.
- `seriesPath(slug: string): string` → `/events/${slug}`.
- `jsonLdForRoute` for a series route → `[organization, ...events of that series only]`.
- `contactPath` unchanged; `contactPath({ service: 'sponsorship' })` → `/contact?service=sponsorship`.

- [ ] **Step 1: Failing tests** — `ROUTES` has 10 paths with the 4 series paths; titles unique; `MAIN_ROUTES.map(r=>r.navLabel)` equals `['Home','Events','Services','About','News','Contact']`; series route title `Build Expo | MEDIUM Events Maldives`, `ogImage` `/images/fb/build-expo-2025.jpg`; `routeForPath('/events/build-expo/')!.seriesSlug === 'build-expo'`; series JSON-LD for CIF has 1 + 3 objects and every Event name contains "Construction Industry Forum"; sitemap has 10 `<loc>`.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** Implement. Rewrite all six main titles/descriptions in the new voice (British English, ≤160 chars, unique; Events title `Events | MEDIUM Events Maldives`). Series description: one sentence from `tagline` + editions count.
- [ ] **Step 4:** `npx vitest run` → pass (update round-one route assertions that pinned old labels/titles to the new ones).
- [ ] **Step 5:** Commit `feat: add event series routes and per-series structured data`.

### Task 4: Header, footer and layout

**Files:** Modify `src/components/Navbar.tsx`, `src/components/Footer.tsx`, `src/App.tsx`; Create `src/components/Layout.test.tsx`.

**Interfaces — Consumes:** `MAIN_ROUTES`, `routeForPath`, `contactPath`, `EVENT_SERIES`, `seriesPath`, ui primitives.

- [ ] **Step 1: Failing tests** (render `AppRoutes` in `MemoryRouter`):
  - Header nav links are exactly Home, Events, Services, About, News, Contact with paths from Global Constraints.
  - "Become a sponsor" link `href` = `/contact?service=sponsorship`.
  - At `/events/build-expo`, the "Events" nav link has `aria-current="page"`.
  - Mobile: click "Open menu" → panel shows the six links and "Become a sponsor"; click "About" → menu button label returns to "Open menu".
  - Footer contains a link to each `seriesPath(slug)` and the WhatsApp number `+960 799-7974`.
  - No element has class matching `/glass|gradient|blur/` in the header or footer.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** Implement per spec §2 "Layout chrome": white sticky header with `border-b border-line`, `Logo light={false}`; footer `bg-footer`. Remove `ScrollProgress` from `App.tsx`. Keep tel/mailto `contact_click` tracking and WhatsApp button.
- [ ] **Step 4:** `npx vitest run` → pass (update `src/AppRoutes.test.tsx` assertions that used old labels "Info Center"/"Project Enquiry" to the new nav/footer labels); `npm run lint` clean.
- [ ] **Step 5:** Browser check (dev server) at 1280px and 375px: header, menu, footer.
- [ ] **Step 6:** Commit `feat: corporate header and footer`.

### Task 5: Event series pages

**Files:** Create `src/pages/SeriesPage.tsx`, `src/pages/SeriesPage.test.tsx`; Modify `src/AppRoutes.tsx`.

**Interfaces — Consumes:** `seriesBySlug`, `editionsFor`, `contactPath`, `seriesPath`, ui primitives. **Produces:** route `/events/:slug` → `SeriesPage`; unknown slug renders `EventsPage` (no redirect).

- [ ] **Step 1: Failing tests** (render at `/events/<slug>` in `MemoryRouter` + `AppRoutes`):
  - CIF page: `h1` "Construction Industry Forum"; shows "Endorsed by MNACI"; link to `https://cif.mv` with `target="_blank"`; shows 3 edition cards (CIF 2025, 2024, 2023) and none named "Aviation Forum"; partner "Ooredoo Maldives" with role text.
  - Aviation page: "Become a sponsor" link `href` === `contactPath({ event: 'Aviation Forum – Connecting Maldives' })`; following it (click) renders the form with service "Sponsorship or exhibition stand" and message containing "Aviation Forum – Connecting Maldives".
  - Build Expo page: key facts read "1 edition"; secondary link "Book a stand" present.
  - `/events/build-expo/` renders the Build Expo `h1`; `/events/nope` renders the Events page heading without throwing.
  - Each page shows "Next edition: dates to be announced."
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** Implement per spec §3.1 (sections in order). Edition cards: banner `<img>` with `width`/`height` and `loading="lazy"`, date, venue, `{n} responded`, "View on Facebook" (`facebook_event_click`). Pluralise "edition(s)".
- [ ] **Step 4:** `npx vitest run` → pass; `npm run build` → build check passes for 10 pages.
- [ ] **Step 5:** Commit `feat: add event series pages`.

### Task 6: Home page

**Files:** Rewrite `src/pages/HomePage.tsx`; Create `src/pages/HomePage.test.tsx`.

**Interfaces — Consumes:** ui primitives, `EVENT_SERIES`, `seriesPath`, `PAST_EVENTS_DATA`, `SITE_STATS`, `VERIFIED_PARTNERS`, `SERVICES_DATA`, `contactPath`.

- [ ] **Step 1: Failing tests** — `h1` exact Home H1; intro exact; "Become a sponsor" → `/contact?service=sponsorship` and "Explore events" → `/events`; 4 series cards linking to each `seriesPath`; 3 latest event cards (AF 2026, CIF 2025, MMIF 2025 in that order); 4 service cards; stats show 9 / 4 / 2023 / 60+; partners show MNACI, Ooredoo Maldives, SITA; hero image `src` `/images/fb/ooredoo-cif-2026-signing.jpg` with `fetchpriority="high"`.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** Implement per spec §3 Home row; sponsor band copy exact.
- [ ] **Step 4:** `npx vitest run` → pass.
- [ ] **Step 5:** Commit `feat: rebuild home page in corporate style`.

### Task 7: Events overview page

**Files:** Rewrite `src/pages/EventsPage.tsx`; Modify `src/components/PastEventsSection.tsx`; update `src/AppRoutes.test.tsx`.

- [ ] **Step 1: Failing tests** — `/events` has `h1` "Events"; 4 series cards linking to series pages; track record heading present with 9 edition cards and series filter buttons; no element text "Sponsorship" pointing at removed events (HOSCO/Marine Expo).
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** Implement; restyle `PastEventsSection` with palette classes (keep its props, filters, links, tracking); `limit` mode no longer used by Home (Home has its own latest-events block) — keep the prop.
- [ ] **Step 4:** `npx vitest run` → pass.
- [ ] **Step 5:** Commit `feat: rebuild events overview page`.

### Task 8: Services and About pages

**Files:** Rewrite `src/pages/ServicesPage.tsx`, `src/pages/AboutPage.tsx`; Create `src/pages/ServicesAbout.test.tsx`.

- [ ] **Step 1: Failing tests** — Services: `h1` present, 4 services each with "Request a proposal" → `contactPath({ service: id })`; About: `h1` present, the five medium.mv principles rendered as a list, stats strip, partners strip; neither page contains "nation-scale", "mandate", "bespoke" (case-insensitive).
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** Implement. About principles (from medium.mv, rewritten plainly): we know the market and your customers; quality-driven, ideas unique to each client; results you can measure; long-term plans for selected clients; easy to start — reach out and we take it from there. "Who we are": 60+ years combined experience, 15+ years per person in management.
- [ ] **Step 4:** `npx vitest run` → pass.
- [ ] **Step 5:** Commit `feat: rebuild services and about pages`.

### Task 9: News and Contact pages

**Files:** Modify `src/pages/NewsPage.tsx`, `src/components/NewsSection.tsx`, `src/components/NewsModal.tsx`, `src/pages/ContactPage.tsx`, `src/components/EnquiryForm.tsx`, `src/components/EnquiryForm.test.tsx`, `src/lib/enquiry.test.ts`.

**Interfaces — Consumes:** `SERVICE_OPTIONS` (Task 2).

- [ ] **Step 1: Failing tests** — form at `/contact?service=sponsorship` selects "Sponsorship or exhibition stand"; at `/contact?event=X` selects the same and message contains X; service `<select>` options equal `SERVICE_OPTIONS` labels; News page `h1` present and article cards only for verified articles (2); contact page shows WhatsApp number and opening hours "Sunday – Thursday, 09:00 – 17:00 (Maldives time, UTC+5)". Update round-one assertions from "Flagship Expo Sponsorship / Booth" to "Sponsorship or exhibition stand".
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** Implement: form markup restyled with palette (labels with `htmlFor`/`id`), all round-one states/fallbacks/honeypot/timeout/tracking unchanged; News cards and modal restyled.
- [ ] **Step 4:** `npx vitest run` → pass.
- [ ] **Step 5:** Commit `feat: rebuild news and contact pages`.

### Task 10: Remove old content, guard it, document it

**Files:** Delete `src/components/{EventModal,EventMarquee,EventsSection,ScrollProgress,StatsBar,Hero,AboutSection,ServicesSection}.tsx`, `src/hooks/useMarqueeEventModal.tsx`; Modify `src/data/websiteData.ts` (remove `FLAGSHIP_EVENTS_DATA`, `CLIENT_PARTNERS`, unverified news), `src/types.ts` (remove `FlagshipEvent`), `src/index.css` (remove glass/marquee/mask classes); Create `src/contentGuard.test.tsx`, `docs/content-to-confirm.md`; Modify `README.md`.

- [ ] **Step 1: Failing test** `src/contentGuard.test.tsx` — for every route in `ROUTES`, render in `MemoryRouter` and assert `document.body.textContent` (case-insensitive) contains none of the Global Constraints banned strings; also assert `src/data/websiteData.ts` source text contains none of them (read with `fs`).
- [ ] **Step 2:** run → FAIL (old data still present).
- [ ] **Step 3:** Delete/clean listed files; write `docs/content-to-confirm.md` (every removed claim with where it was and why; plus "what would strengthen the site": hi-res photos, partner logo files, testimonials, team, next edition dates, Marine Expo/HOSCO details if real). README: update page list and mention series pages are data-driven.
- [ ] **Step 4:** `npm run lint && npx vitest run && npm run build` → all pass; `grep -rn "glass-\|animate-marquee\|from-\[#\|bg-gradient" src` → no matches.
- [ ] **Step 5:** Commit `refactor: remove unverified content and old components`.

### Task 11: Final verification

- [ ] **Step 1:** `npm run lint && npm test && npm run build` → all pass; build check reports 10 pages.
- [ ] **Step 2:** `vite preview` and, in a fresh browser tab, load all 10 routes directly at 1280px and 375px: no console errors, no horizontal overflow, header/menu/footer correct, each series CTA pre-fills the form, legacy `/#events` still redirects, WhatsApp button visible except on `/contact`.
- [ ] **Step 3:** Screenshot Home, one series page and Contact at both widths for the user.
- [ ] **Step 4:** Commit any fixes (each with its failing test first).
