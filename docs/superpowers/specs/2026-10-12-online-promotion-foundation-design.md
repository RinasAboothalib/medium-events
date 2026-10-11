# Online Promotion — Piece 1: Foundation (Get Found, Get Shared, Get Leads)

**Date:** 2026-10-12
**Status:** Approved in conversation, awaiting spec review
**Client:** MEDIUM Events Pvt Ltd (production site, intended to replace medium.mv)

## 1. Context and goal

The site is a Vite + React 19 single-page app. All six sections live on one URL and switch via `#hash`, so:

- Google indexes only one page; individual sections and events can't rank.
- Shared links on Facebook/WhatsApp/LinkedIn show no image (no `og:image`).
- The enquiry form is simulated (`EnquiryForm.tsx` waits 900 ms and shows a fake `MED-xxxxxx` reference) — **every real lead is lost**.
- There is no structured data, sitemap, or analytics.

The site must serve all of: winning sponsors/exhibitors for flagship events, winning agency clients, and brand credibility. Hosting is **not decided**, so the output must be plain static files that work on any host (Vercel, Netlify, cPanel, etc.).

This spec covers **Piece 1 only**. Later pieces, each with its own spec:

- **Piece 2 — Sponsor-selling event pages:** `/events/<series-slug>` per series (CIF, MMIF, Aviation Forum, Build Expo) with editions, photos, past sponsors, next date, sponsor/booth CTAs.
- **Piece 3 — Amplifiers:** photo gallery, share buttons, newsletter signup, "Why sponsor with MEDIUM" pitch.

### Success criteria

1. Each page has a real URL and is served as pre-rendered HTML containing its own content, title, description, canonical, and share image.
2. A submitted enquiry reaches info@medium.mv (once the Web3Forms key is configured), and no submission path ever discards a lead.
3. A WhatsApp chat entry point is visible on every page.
4. `sitemap.xml` and `robots.txt` exist in the build output and list every page with the configured domain.
5. GA4 records page views and key lead actions when a measurement ID is configured, and loads nothing otherwise.
6. `npm run lint`, `npm test`, and `npm run build` (including the build check) all pass.

## 2. Pages and URLs

| Page | Path | Replaces hash |
|---|---|---|
| Home | `/` | `#home` |
| Services | `/services` | `#services` |
| Flagship Events | `/events` | `#events` |
| About & Credibility | `/about` | `#about` |
| Info Center | `/news` | `#info-center` |
| Enquiry | `/contact` | `#enquiry` |

- **Router:** add `react-router` (v7, library/"declarative" mode — `BrowserRouter` on the client, `StaticRouter` for pre-rendering). No framework mode.
- **Single route table** — `src/routes.ts` exports an array of `{ path, title, description, ogImage }` that drives the router, pre-rendering, sitemap, and build check. Piece 2 adds event-series entries here.
- **Layout:** `App.tsx` becomes a layout (ScrollProgress, Navbar, `<Outlet/>` inside the existing `AnimatePresence` fade, Footer, WhatsApp button). Each page's current JSX block in `App.tsx` moves into `src/pages/<Name>Page.tsx`.
- **Navigation:** Navbar, Footer, and in-page CTAs use router `Link`/`useNavigate` instead of `onNavigate(sectionId)`. Active nav state comes from the current location. Scroll-to-top on route change is preserved.
- **Legacy hash redirect:** on first client load, if `location.pathname === '/'` and the hash matches a legacy id (`home`, `services`, `events`, `about`, `info-center`, `enquiry`), `navigate(newPath, { replace: true })`. Mapping lives in a pure function `legacyHashToPath(hash): string | null` (unit-tested).
- **Enquiry prefill via URL:** replaces `prefilledService`/`prefilledEvent` React state.
  - `/contact?service=<serviceId>` → selects that service.
  - `/contact?event=<event name>` → selects **"Flagship Expo Sponsorship / Booth"** (existing option) and pre-writes the message for that event.
- **Marquee modal:** the home/events marquee keeps opening `EventModal` in place (local state in the page component), unchanged in behavior.

### Pre-rendering

- Add `src/entry-server.tsx` exporting `render(url): string` that renders the app inside `StaticRouter` with `renderToString`.
- `src/main.tsx` uses `hydrateRoot` when `#root` has children, else `createRoot`.
- Build pipeline (`npm run build`):
  1. `vite build` → `dist/` (client).
  2. `vite build --ssr src/entry-server.tsx --outDir dist-ssr` → server bundle.
  3. `node scripts/prerender.mjs` → for each route in the route table: render HTML, inject it into `#root` of `dist/index.html`, replace the head meta block (see §3), write `dist/<path>/index.html` (`/` → `dist/index.html`). Also writes `sitemap.xml` and `robots.txt`.
  4. `node scripts/check-build.mjs` → build check (see §5). Non-zero exit fails the build.
- Motion animations: content that animates in via `initial={{ opacity: 0 }}` must not be invisible in the static HTML to crawlers that don't run JS. Facebook/LinkedIn only read the `<head>`, and Google runs JS, so this is acceptable; no change required. The `<head>` metadata is what matters for sharing and is fully static.
- Any browser-only code (`window`, `document`, `localStorage`) at module top level or during render must be guarded so `renderToString` doesn't throw.

## 3. Search and share metadata

### Per-page head

`scripts/prerender.mjs` replaces a marked block in `index.html` (`<!--app-head-->`) with, per route:

- `<title>` — e.g. `Flagship Events | MEDIUM Events Maldives`
- `<meta name="description">`
- `<link rel="canonical" href="{SITE_URL}{path}">`
- Open Graph: `og:title`, `og:description`, `og:url`, `og:type=website`, `og:image` (absolute URL), `og:image:width`, `og:image:height`, `og:site_name=MEDIUM Events`
- Twitter: `twitter:card=summary_large_image`, `twitter:title`, `twitter:description`, `twitter:image`

The static meta tags currently hard-coded in `index.html` are removed in favor of the generated block.

On the client, a small `usePageMeta(route)` hook updates `document.title` on navigation (so tabs and GA page titles are right after client-side route changes).

### Share images

Existing photos already sized for previews:

| Pages | Image |
|---|---|
| Home, Services, Events, About, Contact | `/images/fb/cif-2025.jpg` (event collage, 960×453) |
| News | `/images/fb/ooredoo-cif-2026-signing.jpg` |

Each route entry names its own `ogImage`, so Piece 2 series pages use their own banners.

### Structured data (JSON-LD)

- **All pages:** `Organization` — name `MEDIUM Events Pvt Ltd`, url, logo, address (Champa Building 4, 5th Floor, Orchid Magu, K. Malé, Maldives), telephone(s), email, `sameAs` [Facebook, Instagram, LinkedIn]. Built from `COMPANY_DETAILS`.
- **`/events`:** one `Event` object per entry in `PAST_EVENTS_DATA` — `name`, `startDate`, `location` (`Place` with name + address), `organizer` (the Organization), `image`, `eventStatus` `EventScheduled`, `eventAttendanceMode` `OfflineEventAttendanceMode`.
- JSON-LD is generated by pure functions in `src/seo/structuredData.ts` (unit-tested) and injected by the prerender script as `<script type="application/ld+json">`.

### Sitemap and robots

- `sitemap.xml` — one `<url><loc>` per route, from the route table, using `SITE_URL`. Generated by a pure function `buildSitemap(routes, siteUrl)` (unit-tested).
- `robots.txt` — `User-agent: *`, `Allow: /`, `Sitemap: {SITE_URL}/sitemap.xml`.

### Configuration

- `VITE_SITE_URL` env var, default `https://medium.mv`, no trailing slash. Used for canonical, `og:url`, `og:image`, sitemap.

### Post-launch (Medium's action)

Add the site to Google Search Console with their Google account, verify ownership, and submit `{SITE_URL}/sitemap.xml`.

## 4. Lead capture

### Enquiry form

- **Delivery:** `POST https://api.web3forms.com/submit` (JSON) with `access_key` = `VITE_WEB3FORMS_KEY`, `subject` = `New enquiry: <service>[ – <event>]`, `from_name` = `MEDIUM Website`, `botcheck` honeypot, and all form fields (name, company, email, phone, service, timeline, budget, message, event, page URL).
- **Spam:** a visually hidden `botcheck` checkbox (Web3Forms convention). No CAPTCHA.
- **States:**
  - *Sending* — button spinner, inputs disabled.
  - *Success* — "Thanks, {name}. MEDIUM will be in touch within 1 business day." The fake `MED-xxxxxx` reference is removed.
  - *Error* (network failure or `success: false`) — form data is kept; an inline panel says it couldn't send and offers **Send on WhatsApp instead** and **Send by email instead**, both pre-filled with the full enquiry.
  - *No key configured* — the submit button reads **Send via WhatsApp**, with a secondary **Send by email** link; both open pre-filled. The site can go live before the key exists and switches to email delivery as soon as the env var is set.
- **Logic location:** `src/lib/enquiry.ts` — `submitEnquiry(data, key, fetchImpl)` returning `{ ok: true } | { ok: false, reason }`; `buildWhatsAppUrl(number, text)`; `buildMailtoUrl(to, subject, body)`; `formatEnquiryText(data)`. All pure or fetch-injected, unit-tested.

### WhatsApp

- `COMPANY_DETAILS.whatsapp = '+960 799-7974'` (stated WhatsApp-enabled in their Build Expo post); one place to change.
- **Floating button** — `src/components/WhatsAppButton.tsx`, fixed bottom-right on every page, green, accessible label "Chat with MEDIUM on WhatsApp", opens `https://wa.me/9607997974` in a new tab with the pre-filled text "Hi MEDIUM, I'm interested in your events and services." (URL-encoded via `buildWhatsAppUrl`). Must not cover the form's submit button on mobile (add bottom padding on `/contact` or offset the button).

### Event CTAs

"Sponsorship" / "Enquire as Sponsor / Exhibitor" buttons on `EventsSection` and `EventModal` link to `/contact?event=<event name>`.

### Medium's action

Sign up at web3forms.com with info@medium.mv; provide the access key (public by design) to set as `VITE_WEB3FORMS_KEY`.

## 5. Analytics and testing

### Analytics (GA4)

- `src/lib/analytics.ts` — `initAnalytics(id)` injects the gtag script only when `VITE_GA_ID` is set and only in the browser; `trackPageView(path, title)` on route change; `trackEvent(name, params)`.
- Events:

| Event | When | Params |
|---|---|---|
| `generate_lead` | enquiry delivered via Web3Forms | `service`, `event` |
| `whatsapp_click` | any WhatsApp link/button | `location` (floating, form, fallback) |
| `contact_click` | `tel:` / `mailto:` links | `method` (phone, email) |
| `facebook_event_click` | "View Event" on a past-event card | `event_id` |

- No cookie banner in Piece 1; all analytics code is isolated in `analytics.ts` so consent mode can be added later.
- **Medium's action:** create a GA4 property and provide the `G-XXXXXXX` ID.

### Testing

- Add **Vitest** (+ `@testing-library/react`, `jsdom`) and `npm test`.
- Unit tests:
  - `legacyHashToPath` — every legacy hash maps correctly; unknown → `null`.
  - `buildSitemap` — every route present, domain applied, no double slashes.
  - `structuredData` — Organization fields and one Event per past event with ISO dates.
  - `enquiry.ts` — success path posts correct payload; `success:false` and network error return `ok:false`; WhatsApp/mailto URLs are correctly encoded; formatted text includes all fields.
  - `EnquiryForm` (Testing Library) — no key → WhatsApp/email mode; failed submit keeps entered data and shows fallback buttons; `?event=` prefill selects sponsorship.
- **Build check** (`scripts/check-build.mjs`) — for each route, `dist/<path>/index.html` exists and contains a non-empty `<title>` unique across pages, a description, canonical, `og:image` with absolute URL, rendered app markup inside `#root`; `sitemap.xml` and `robots.txt` exist.
- **Manual:** click through all pages and CTAs at desktop and mobile widths in the browser; verify legacy `#events` links redirect; after deployment, verify previews in Facebook Sharing Debugger.

## 6. Out of scope (Piece 1)

- Per-series event pages, gallery, share buttons, newsletter, sponsor pitch (Pieces 2–3).
- Cookie/consent banner.
- CMS or admin editing — content stays in `src/data/websiteData.ts`.
- Choosing/configuring a host; documentation will note that any static host works and SPA fallback is not required because every route is pre-rendered.
- Removing unused dependencies (`@google/genai`, `express`) — noted, not touched.

## 7. Files

**New:** `src/routes.ts`, `src/pages/*Page.tsx` (6), `src/entry-server.tsx`, `src/seo/structuredData.ts`, `src/seo/sitemap.ts`, `src/lib/enquiry.ts`, `src/lib/analytics.ts`, `src/lib/legacyHash.ts`, `src/hooks/usePageMeta.ts`, `src/components/WhatsAppButton.tsx`, `scripts/prerender.mjs`, `scripts/check-build.mjs`, tests alongside sources, `vitest.config.ts`.

**Modified:** `App.tsx` (layout), `main.tsx` (router + hydrate), `Navbar.tsx`, `Footer.tsx`, `Hero.tsx`, `EventsSection.tsx`, `EventModal.tsx`, `NewsSection.tsx`/`NewsModal.tsx` (CTA links), `EnquiryForm.tsx`, `PastEventsSection.tsx` (link + tracking), `websiteData.ts` (`whatsapp`), `index.html` (`<!--app-head-->` marker), `package.json` (scripts, deps), `.env.example` (`VITE_SITE_URL`, `VITE_WEB3FORMS_KEY`, `VITE_GA_ID`).
