# MEDIUM Events website

Website for MEDIUM Events Pvt Ltd (Malé, Maldives), built with React, Vite and Tailwind.

## Run locally

```bash
npm install
npm run dev
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm test` | Unit and component tests (Vitest) |
| `npm run lint` | TypeScript type check |
| `npm run build` | Production build: pre-renders every page, writes `sitemap.xml` and `robots.txt`, then checks every page has its title, description, canonical link and share image |
| `npm run preview` | Serves the production build from `dist/` |

Pages are listed once in `src/routes.ts`. Adding a page there adds it to the router, the pre-rendered output, the sitemap and the build check.

## Content

- All site content lives in `src/data/websiteData.ts`.
- **Event series pages** (`/events/<slug>`) are generated from `EVENT_SERIES`; each past event in `PAST_EVENTS_DATA` belongs to a series. Adding a new edition (e.g. CIF 2027) is one new entry in `PAST_EVENTS_DATA` plus its banner in `public/images/fb/` — the series page, Home, Events page, structured data and stats update automatically.
- Only verified facts are used. See `docs/content-to-confirm.md` for removed claims awaiting confirmation; `src/contentGuard.test.tsx` blocks them from returning.
- Design: colours are defined once in `src/design/palette.ts` (mirrored in `src/index.css`) and checked for WCAG AA contrast by tests; pages are built from the shared components in `src/components/ui/`.

## Deploying and configuration

1. Copy `.env.example` to `.env` and fill in the values below.
2. Run `npm run build`.
3. Upload the contents of `dist/` to any static host (Vercel, Netlify, Cloudflare Pages, cPanel/Apache, etc.). Every page is a real HTML file, so no server is needed.
   - **Do not add a single-page-app rewrite** (e.g. "/* → /index.html"). Unknown addresses should get `404.html`, which Netlify, Vercel, Cloudflare Pages and GitHub Pages serve automatically.
   - **Apache / cPanel:** the included `.htaccess` serves `/contact` from `contact.html` instead of redirecting to `/contact/`, and serves `404.html` for unknown addresses. Make sure hidden files are uploaded and `mod_rewrite` is enabled. After launch, check that `https://medium.mv/contact` loads without a redirect.

| Variable | Purpose | If empty |
|---|---|---|
| `VITE_SITE_URL` | Live address, e.g. `https://medium.mv`. Used for canonical links, share previews and the sitemap. | Defaults to `https://medium.mv` |
| `VITE_WEB3FORMS_KEY` | Access key from [web3forms.com](https://web3forms.com). Enquiries are emailed to the address the key was created with. | The enquiry form sends via WhatsApp or email instead |
| `VITE_GA_ID` | Google Analytics 4 measurement ID (`G-XXXXXXX`). | No analytics are loaded |
| `VITE_ADMIN_API_URL` | Address of the MEDIUM admin server, e.g. `https://admin.medium.mv`. The build uses events published from the admin. | Built-in event list |

### One-time setup for MEDIUM

1. **Enquiry emails:** sign up at web3forms.com with info@medium.mv and send the access key to the developer (it is safe to include in the website).
2. **Analytics:** create a Google Analytics 4 property and send the measurement ID. In the web data stream, open *Enhanced measurement* settings and turn **off** "Page changes based on browser history events" — the site reports page views itself, and leaving it on double-counts them. Tracked actions: `generate_lead` (enquiry delivered), `whatsapp_click`, `contact_click` (phone/email links), `facebook_event_click`.
3. **Google Search:** after launch, add the site in [Google Search Console](https://search.google.com/search-console), verify ownership and submit `https://medium.mv/sitemap.xml`.
4. **Social previews:** paste each page URL into the [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) to confirm the preview image and text.

The WhatsApp number is set once in `src/data/websiteData.ts` (`COMPANY_DETAILS.whatsapp`).

## Admin backend

Staff manage the business from the admin app (`admin/`), which talks to the MEDIUM server (`server/`). The server holds all the data and does all the sign-in and permission checks. Supabase, if used, is only the database: no Supabase accounts, emails or keys in the apps.

### Run it locally

In two terminals:

```bash
npm --prefix server install
npm --prefix server run dev
```

```bash
npm --prefix admin install
npm --prefix admin run dev
```

Open http://localhost:3010 (or use **Staff login** in the website footer). The admin app forwards `/api` to the server on port 3020.

### First sign-in

- Email `admin@medium.mv`, password `Medium@2026!` (or `DEFAULT_ADMIN_PASSWORD` from `server/.env`).
- You must choose a new password straight away; until then the server refuses everything else and prints a warning at start-up.
- The default admin is only created when the database has no users, so it never comes back once staff exist.
- Add staff from **Staff** with a temporary password and pass it on yourself (no emails are sent). They choose their own at first sign-in. Forgotten passwords: an admin sets a new temporary one.

### What staff can do

| Section | Who | What |
|---|---|---|
| Dashboard | everyone | Figures for their role (enquiries, money per currency, upcoming events) |
| Events | everyone reads; admin and events team edit | Series, editions, banners, partners, attendance and outcome notes |
| Programme (inside an edition) | everyone reads; admin and events team edit | Speakers and sessions in running order, by day |
| Delegates (inside an edition) | admin and events team edit; sales read | The delegate register, search, and check-in at the door |
| Tasks (inside an edition) | everyone reads; admin and events team edit | Planning checklist with due dates and who is responsible |
| Budget (inside an edition) | admin and finance | Expenses per currency, set against sponsorship income; the events team never sees it |
| Publish | admin, events team | Sends events to the website |
| Enquiries | admin, sales | Website and manual leads, status, assignee, notes |
| Sponsors and Deals | everyone reads; admin and sales edit | Sponsor companies and deals per event in MVR or USD; the events team never sees amounts |
| Payments (inside a deal) | admin and finance record; sales read; admin deletes | Received and outstanding per deal |
| Reports | per role | Post-event (PDF), sponsorship (PDF, Excel), enquiries (Excel), delegates (Excel), budget (Excel) |
| Staff, Activity log, My account | as before | |

### Where the data lives

- **Default:** a local Postgres database in `server/.data/` (created automatically, git-ignored). Back it up by copying the folder while the server is stopped.
- **Supabase:** copy `server/.env.example` to `server/.env` and set `DATABASE_URL` to the Supabase connection string (Project Settings > Database > Connection string > Session pooler, with your database password). Tables are created on start-up. Backups are handled by Supabase. Never put the connection string or any Supabase key in the website or admin app.

### Events on the website

- Staff manage event series, editions, banners and partners under **Events**. The admin starts with MEDIUM's nine past events, copied from the website.
- **Publish** sends them to the website: set `VITE_ADMIN_API_URL` (the admin server's address) in the website's `.env`, and `npm run build` downloads the published events and banners before building. Without it, or before the first publish, the site uses its built-in event list.
- Programme, delegates, tasks and budget are for running the event; they stay in the admin and are not published to the website. An edition with deals, delegates or expenses can't be deleted (cancel it instead); its tasks and programme are deleted with it.
- To rebuild the site automatically after publishing, set `SITE_DEPLOY_HOOK_URL` in `server/.env` to your host's deploy hook (Netlify, Vercel and Cloudflare Pages all provide one), and `PUBLIC_SITE_ORIGIN` to the website's address.

### Production

Build both with `npm --prefix server run build` and `npm --prefix admin run build`, then run `npm --prefix server start` with `NODE_ENV=production` on any Node 22 host (Render, Railway, Fly.io, a VPS). In production the server also serves the built admin app, so one address (e.g. `https://admin.medium.mv`) gives both the app and `/api`, and the session cookie is HTTPS-only. Set `DATABASE_URL` to Supabase there. On the website, set `VITE_ADMIN_URL` (footer Staff login link) and `VITE_ADMIN_API_URL` (published events and enquiries) to that address.

| Command | What it does |
|---|---|
| `npm --prefix server test` | Server tests (sign-in, permissions for every role, events, publishing, enquiries, sponsors, deals, payments, reports) |
| `npm --prefix server run smoke` | Calls every API route over real HTTP as each role, against a throwaway in-memory database, and prints one line per call |
| `npm --prefix admin test` | Admin app tests |
