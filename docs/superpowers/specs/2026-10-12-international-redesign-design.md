# International Redesign — Corporate Expo Direction

**Date:** 2026-10-12
**Status:** Approved in conversation, awaiting spec review
**Builds on:** `docs/superpowers/specs/2026-10-12-online-promotion-foundation-design.md` (branch `feat/promotion-foundation`). Everything that spec delivered — real URLs, pre-rendering, per-page SEO, sitemap, build check, Web3Forms enquiry with WhatsApp/email fallbacks, floating WhatsApp button, GA4 — is kept and must keep working.

## 1. Goal

MEDIUM Events is a foreign-owned company in the Maldives selling sponsorship, exhibition space and agency services to an international audience. The site must read as international-standard: premium visual design, professional writing, and credible proof. English only.

Chosen direction: **C · Corporate expo** — white base, MEDIUM royal blue as the single accent, structured cards, sponsor-first calls to action (the style of large international expo organisers).

### Success criteria

1. Every page uses the new design system (§2); no gradients, glows, glass panels, blur or gold accents remain.
2. Four event series pages exist and are pre-rendered with their own SEO metadata and structured data.
3. Every factual claim on the site traces to MEDIUM's Facebook page, their medium.mv site, or their event banners. A guard test fails if removed unverified claims reappear.
4. All text/background colour pairs in the palette meet WCAG 2.1 AA (4.5:1 normal text, 3:1 large text ≥ 24px or ≥ 18.66px bold).
5. `npm run lint`, `npm test`, `npm run build` (including the build check over all 10 pages) pass; no console errors on any page at 1280px and 375px.

## 2. Look and feel

### Palette (Tailwind theme tokens in `src/index.css` `@theme`)

| Token | Hex | Use |
|---|---|---|
| `brand` | `#12229D` | Primary buttons, links, hero block, accents |
| `brand-hover` | `#0E1A7A` | Hover/pressed for brand |
| `brand-tint` | `#EEF0FB` | Highlight backgrounds, icon chips |
| `ink` | `#101828` | Headings |
| `body` | `#475467` | Body text |
| `muted` | `#667085` | Meta text, captions (only on white/`surface`) |
| `line` | `#E4E7EC` | Borders, dividers |
| `surface` | `#F8FAFC` | Alternating section background |
| `footer` | `#0A1240` | Footer background (only dark area); text on it white / `#C7CCF5` |
| `on-brand-muted` | `#C7CCF5` | Secondary text on `brand` and `footer` |

Removed: gold/yellow accents, glows, glass/blur panels, gradients, background glow blobs, `glass-*` classes.

### Typography

Inter (already loaded). Headings 600–700 weight, sentence case, tight tracking. Uppercase only for small eyebrow labels (12px, letter-spaced). Body 16px (17px on large screens), line-height 1.6–1.7.

### Shared UI primitives (`src/components/ui/`)

| Component | Purpose |
|---|---|
| `Container` | Max-width 1200px, responsive side padding (16/24/32px) |
| `Section` | Vertical rhythm; `tone: 'white' \| 'surface' \| 'brand'` |
| `SectionHeader` | Eyebrow + heading + optional intro paragraph; `align: 'left' \| 'center'` |
| `Button` | `variant: 'primary' \| 'secondary'`; renders router `Link` for internal `to`, `<a>` for `href` |
| `Card` | White, 1px `line` border, 8px radius; hover border turns `brand`; no scale/lift |
| `StatStrip` | Row of `{ value, label }` |
| `PartnerStrip` | Row of partner names (text, no logo images) |
| `CtaBand` | Full-width brand-blue band with heading, text and up to two buttons |
| `PageHeader` | Top-of-page title block for inner pages (eyebrow, H1, intro) |

Rules: at most one primary button per section; cards never animate scale; focus-visible ring on every interactive element (2px `brand`, 2px offset).

### Layout chrome

- **Header:** white, sticky, 1px bottom border; Logo (dark wordmark variant, `light={false}`); nav: Home · Events · Services · About · News · Contact; primary button **Become a sponsor** → `contactPath({ service: 'sponsorship' })` (see §4). Mobile: menu button opens a full-width panel. Phone number removed from header.
- **Footer:** `footer` navy; logo (light), short description, nav, event series links, contact details (address, phones, WhatsApp, email), social links (Facebook, Instagram, LinkedIn), copyright line.
- **Motion:** sections fade-in once on scroll (opacity + 8px translate, ≤ 400ms); page fade between routes (existing). No marquee, no bounce, no pulse, no scroll progress bar.

## 3. Pages

Navigation labels change: "Flagship Events" → "Events", "About & Credibility" → "About", "Info Center" → "News", "Enquiry" → "Contact". Paths for existing pages are unchanged.

| Page | Path | Sections (top to bottom) |
|---|---|---|
| Home | `/` | Hero (split: brand block with headline, intro, primary "Become a sponsor" + secondary "Explore events"; right: Ooredoo signing photo) · StatStrip · Event series (4 cards → series pages) · Latest events (3 most recent `PAST_EVENTS_DATA`) · Services (4 cards → `/services`) · PartnerStrip · CtaBand |
| Events | `/events` | PageHeader · Series cards (4) · Track record by year (restyled `PastEventsSection`, series filter kept) · CtaBand |
| Series ×4 | `/events/<slug>` | §3.1 |
| Services | `/services` | PageHeader · 4 services (title, one-line summary, what's included list, "Request a proposal" → `contactPath({ service: id })`) · CtaBand |
| About | `/about` | PageHeader · Who we are (medium.mv copy) · How we work (the five medium.mv principles) · StatStrip · PartnerStrip · CtaBand |
| News | `/news` | PageHeader · article cards (verified items only) · article detail stays a modal |
| Contact | `/contact` | PageHeader · two columns: contact details (address, phones, WhatsApp, email, hours) and the enquiry form (restyled; all round-one behaviour kept) |

### 3.1 Event series pages

| Slug | Series | Website | Endorsement |
|---|---|---|---|
| `construction-industry-forum` | Construction Industry Forum (CIF) | cif.mv | MNACI |
| `marine-industry-forum` | Maldives Marine Industry Forum (MMIF) | mmif.mv | — |
| `aviation-forum` | Aviation Forum – Connecting Maldives | aviationforum.mv | — |
| `build-expo` | Build Expo | — | Official exhibition of MNACI |

Sections: Header (name, one-line purpose, endorsement badge where true, website link) · Key facts (editions count, first year, usual venue, usual month, audience) · About (from Facebook event descriptions) · Past editions (cards from `PAST_EVENTS_DATA` filtered by series, newest first: banner, date, venue, RSVP count, "View on Facebook") · Partners and sponsors (verified only: CIF — Ooredoo Maldives, Exclusive Platinum Sponsor CIF 2026; Aviation Forum — SITA, sponsor AF 2026; CIF/Build Expo — MNACI) · CTA: "Next edition: dates to be announced. Register your interest." with primary "Become a sponsor" → `contactPath({ event: <series name> })`, and for Build Expo a secondary "Book a stand" → same.

Series pages use their latest edition's banner as `ogImage`. Their JSON-LD is the Organization plus `Event` objects for that series' editions only. `/events` keeps all past events in JSON-LD.

## 4. Data and content

### Data model (`src/data/websiteData.ts`, `src/types.ts`)

- New `EventSeries` type: `{ slug, name, shortName, series: PastEvent['series'], tagline, description: string[], website?: string, endorsement?: string, audience: string, usualVenue: string, usualMonth: string, partners: { name: string; role: string }[], ctaSecondary?: string }`.
- `EVENT_SERIES: EventSeries[]` (4 entries, §3.1). `PastEvent.series` values map 1:1 to `EventSeries.series`.
- Helpers: `editionsFor(series): PastEvent[]` (newest first), `seriesBySlug(slug)`.
- Removed: `FLAGSHIP_EVENTS_DATA` and `FlagshipEvent` type, `EventModal`, `EventMarquee`, `EventsSection`, `useMarqueeEventModal`, `ScrollProgress`, `StatsBar` (replaced by `StatStrip`), `Hero`/`AboutSection`/`ServicesSection` rewritten on primitives.
- `CLIENT_PARTNERS` reduced to verified partners: MNACI (endorsing association, CIF and Build Expo), Ooredoo Maldives (CIF 2026 Exclusive Platinum Sponsor), SITA (Aviation Forum 2026 sponsor).
- `COMPANY_DETAILS.stats` → `[{ '9', 'events hosted' }, { '4', 'event series' }, { '2023', 'first forum' }, { '60+', 'years combined experience' }]` (first three derived from data, not hard-coded).
- Enquiry service options: add `sponsorship` service id mapping to the existing "Flagship Expo Sponsorship / Booth" option label renamed "Sponsorship or exhibition stand". `contactPath({ service: 'sponsorship' })` selects it; `?event=` behaviour unchanged.

### Route table

`ROUTES` gains four entries (`id: 'series-<slug>'`, path `/events/<slug>`, title `<Series name> | MEDIUM Events Maldives`, specific description ≤160 chars, `ogImage` = latest edition banner, `navLabel` = short name). `PageId` widens accordingly. Navbar renders only the six main pages (filter: not series). Sitemap, prerender and build check pick up the new routes automatically.

### Writing rules

- British English (organise, programme, centre).
- Plain, factual, short sentences; sentence case headings; no hype words (nation-scale, executive overview, mandate, indelible, paramount, curate, bespoke, turnkey in headings).
- Every claim traceable to: Facebook events/posts, medium.mv, or event banners.
- Key copy:
  - Home H1: "Meet the Maldives' construction, marine and aviation leaders."
  - Home intro: "MEDIUM Events organises the Construction Industry Forum, the Maldives Marine Industry Forum, the Aviation Forum and Build Expo, and delivers advertising, design and creative consultancy for brands across the Maldives."
  - Sponsor band: "Put your brand in front of the decision makers." / "Sponsorship and exhibition packages for every series."
- Page titles and descriptions in `ROUTES` rewritten in the same voice.

### Removed unverified content (also listed in `docs/content-to-confirm.md`)

Maldives Marine Expo; HOSCO; "12,000+ visitors", "100+ exhibitors", "100+ turnkey productions", "6+ flagship annual expos", per-event attendee figures ("500+ delegates", etc.); endorsements Ministry of Transport, Civil Aviation Authority, Regional Airlines Alliance, Ministry of National Planning, Indian Ocean Divers Association, NBAM, Maldives Publications; news stories "Maldives Marine Expo Secures Landmark Participation" and "MEDIUM Appointed by Maldives Publications". `docs/content-to-confirm.md` also lists what would strengthen the site (hi-res photos, logo files, testimonials, team, next edition dates).

## 5. Photos

- Home hero: `/images/fb/ooredoo-cif-2026-signing.jpg` (2048×1365, real, text-free).
- Series and edition cards: existing event banners.
- All `<img>` get `width`/`height` (or aspect-ratio boxes) and `loading="lazy"` below the fold; hero image `loading="eager"`, `fetchpriority="high"`.
- Optional, user-initiated: if the user logs into Facebook in the browser pane, more event photos may be downloaded (list confirmed with the user first) into `public/images/fb/` and shown as a small gallery on series pages. The design must work without it.

## 6. Testing

- Keep and update the round-one suite (routes, SEO builders, form, WhatsApp, analytics, build check).
- New unit/component tests:
  - Series data integrity: 4 unique slugs; every `PAST_EVENTS_DATA` entry belongs to a series; every series has ≥ 1 edition; `editionsFor` newest first.
  - Routes: 10 routes, unique titles, series routes present, navbar shows only 6 main pages.
  - Series page: renders name, every edition for that series (and none from others), partners, and a "Become a sponsor" link equal to `contactPath({ event: series.name })`.
  - Series JSON-LD: Organization + only that series' editions.
  - Content guard: rendered text of every route contains none of `HOSCO`, `Marine Expo`, `12,000`, `Visiting Guide`, `Maldives Publications`.
  - Contrast: WCAG ratio for each documented text/background pair in §2 meets AA.
  - `Button` renders `Link` for internal `to`, `<a>` for `href`.
- Build check over all 10 pages.
- Browser: every page at 1280px and 375px, no horizontal overflow, no console errors; series CTA pre-fills the form.
- Final fresh whole-branch review.

## 7. Out of scope

Multiple languages; testimonials and team section (no verified source); logo image files for partners; CMS; consent banner; dark mode; changing the hosting setup.
