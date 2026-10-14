# MEDIUM Events website

Website for MEDIUM Events Pvt Ltd (Malé, Maldives), built with React, Vite and Tailwind.

## Project structure

- `Frontend/website/` — public MEDIUM Events website
- `Frontend/admin/` — staff admin web app
- `Backend/server/` — API, authentication, and database
- `docs/` — project design and implementation documents

## Run locally

From the project root, start the public website with:

```bash
npm run dev
```

To start the staff admin app or API, use `npm run dev:admin` or `npm run dev:server` in separate terminals.

## Scripts

| Command | What it does |
|---|---|
| `npm --prefix Frontend/website run dev` | Development server with hot reload |
| `npm --prefix Frontend/website test` | Unit and component tests (Vitest) |
| `npm --prefix Frontend/website run lint` | TypeScript type check |
| `npm --prefix Frontend/website run build` | Production build: pre-renders every page, writes `sitemap.xml` and `robots.txt`, then checks every page has its title, description, canonical link and share image |
| `npm --prefix Frontend/website run preview` | Serves the production build from `dist/` |

Pages are listed once in `Frontend/website/src/routes.ts`. Adding a page there adds it to the router, the pre-rendered output, the sitemap and the build check.

## Content

- All site content lives in `Frontend/website/src/data/websiteData.ts`.
- **Event series pages** (`/events/<slug>`) are generated from `EVENT_SERIES`; each past event in `PAST_EVENTS_DATA` belongs to a series. Adding a new edition (e.g. CIF 2027) is one new entry in `PAST_EVENTS_DATA` plus its banner in `Frontend/website/public/images/fb/` — the series page, Home, Events page, structured data and stats update automatically.
- Only verified facts are used. See `docs/content-to-confirm.md` for removed claims awaiting confirmation; `Frontend/website/src/contentGuard.test.tsx` blocks them from returning.
- Design: colours are defined once in `Frontend/website/src/design/palette.ts` (mirrored in `Frontend/website/src/index.css`) and checked for WCAG AA contrast by tests; pages are built from the shared components in `Frontend/website/src/components/ui/`.

## Deploying and configuration

1. Copy `Frontend/website/.env.example` to `Frontend/website/.env` and fill in the values below.
2. Run `npm --prefix Frontend/website run build`.
3. **Netlify:** connect the GitHub repository and leave the build settings empty; `netlify.toml` builds from `Frontend/website` (so its packages, such as Vite, are installed), publishes `Frontend/website/dist` and uses Node 22. Add the `VITE_*` variables under Site configuration > Environment variables.
4. Other hosts: upload the contents of `Frontend/website/dist/` to any static host (Vercel, Netlify, Cloudflare Pages, cPanel/Apache, etc.). Every page is a real HTML file, so no server is needed.
   - **Do not add a single-page-app rewrite** (e.g. "/* → /index.html"). Unknown addresses should get `404.html`, which Netlify, Vercel, Cloudflare Pages and GitHub Pages serve automatically.
   - **Apache / cPanel:** the included `.htaccess` serves `/contact` from `contact.html` instead of redirecting to `/contact/`, and serves `404.html` for unknown addresses. Make sure hidden files are uploaded and `mod_rewrite` is enabled. After launch, check that `https://medium.mv/contact` loads without a redirect.

| Variable | Purpose | If empty |
|---|---|---|
| `VITE_SITE_URL` | Live address, e.g. `https://medium.mv`. Used for canonical links, share previews and the sitemap. | Defaults to `https://medium.mv` |
| `VITE_WEB3FORMS_KEY` | Access key from [web3forms.com](https://web3forms.com). Enquiries are emailed to the address the key was created with. | The enquiry form sends via WhatsApp or email instead |
| `VITE_GA_ID` | Google Analytics 4 measurement ID (`G-XXXXXXX`). | No analytics are loaded |
| `VITE_ADMIN_API_URL` | Address of the MEDIUM admin server, e.g. `https://admin.medium.mv`. The build uses events published from the admin. | Built-in event list |

### One-time setup for MEDIUM

1. **Enquiry emails:** sign up at web3forms.com with info@medium.mv and configure the access key in `Frontend/website/.env` (it is safe to include in the website).
2. **Analytics:** create a Google Analytics 4 property and send the measurement ID. In the web data stream, open *Enhanced measurement* settings and turn **off** "Page changes based on browser history events" — the site reports page views itself, and leaving it on double-counts them. Tracked actions: `generate_lead` (enquiry delivered), `whatsapp_click`, `contact_click` (phone/email links), `facebook_event_click`.
3. **Google Search:** after launch, add the site in [Google Search Console](https://search.google.com/search-console), verify ownership and submit `https://medium.mv/sitemap.xml`.
4. **Social previews:** paste each page URL into the [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) to confirm the preview image and text.

The WhatsApp number is set once in `Frontend/website/src/data/websiteData.ts` (`COMPANY_DETAILS.whatsapp`).

## Admin backend

Staff manage the business from the admin app (`Frontend/admin/`), which talks to the MEDIUM server (`Backend/server/`). The server holds all the data and does all the sign-in and permission checks. Supabase, if used, is only the database: no Supabase accounts, emails or keys in the apps.

### Run it locally

In two terminals:

```bash
npm --prefix Backend/server install
npm --prefix Backend/server run dev
```

```bash
npm --prefix Frontend/admin install
npm --prefix Frontend/admin run dev
```

Open http://localhost:3010 (or use **Staff login** in the website footer). The admin app forwards `/api` to the server on port 3020.

### First sign-in

- Email `admin@medium.mv`, password `Medium@2026!` (or `DEFAULT_ADMIN_PASSWORD` from `Backend/server/.env`).
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

- **Default:** a local Postgres database in `Backend/server/.data/` (created automatically, git-ignored). Back it up by copying the folder while the server is stopped.
- **Supabase:** copy `Backend/server/.env.example` to `Backend/server/.env` and set `DATABASE_URL` to the Supabase connection string (Project Settings > Database > Connection string > Session pooler, with your database password). Tables are created on start-up. Backups are handled by Supabase. Never put the connection string or any Supabase key in the website or admin app.

### Events on the website

- Staff manage event series, editions, banners and partners under **Events**. The admin starts with MEDIUM's nine past events, copied from the website.
- **Publish** sends them to the website: set `VITE_ADMIN_API_URL` (the admin server's address) in `Frontend/website/.env`, and `npm --prefix Frontend/website run build` downloads the published events and banners before building. Without it, or before the first publish, the site uses its built-in event list.
- Programme, delegates, tasks and budget are for running the event; they stay in the admin and are not published to the website. An edition with deals, delegates or expenses can't be deleted (cancel it instead); its tasks and programme are deleted with it.
- To rebuild the site automatically after publishing, set `SITE_DEPLOY_HOOK_URL` in `Backend/server/.env` to your host's deploy hook (Netlify, Vercel and Cloudflare Pages all provide one), and `PUBLIC_SITE_ORIGIN` to the website's address.

### Production

The backend is one long-running Node 22 server (Render, Railway, Fly.io, a VPS); it doesn't run on static or serverless hosts such as Vercel or Netlify. It serves the API and the built admin app from one address (e.g. `https://admin.medium.mv`), so the admin always reaches `/api` on its own origin. Point the host at the repository root:

| Setting | Value |
|---|---|
| Build command | `npm run build:backend` (installs and builds the admin app and the server) |
| Start command | `npm start` |
| Health check | `/api/health` |
| `NODE_ENV` | `production` (the session cookie is then HTTPS-only, so use the host's HTTPS address) |
| `DATABASE_URL` | Supabase Session pooler connection string. Without it data lives on the host's disk, which most hosts wipe on every deploy. SSL is used automatically, except on the host's private network (e.g. `*.railway.internal`); add `?sslmode=disable` or `?sslmode=require` to override. |
| `PUBLIC_SITE_ORIGIN` | The website's address, e.g. `https://medium.mv, https://www.medium.mv` (comma-separated). Without it browsers block enquiries from the website. |
| `DEFAULT_ADMIN_PASSWORD`, `SITE_DEPLOY_HOOK_URL` | Optional, as in `Backend/server/.env.example` |

**Railway:** `railway.toml` sets the build command, start command and health check, so create a service from the GitHub repository and only add the variables. For the database, add Railway's PostgreSQL and set `DATABASE_URL` to `${{Postgres.DATABASE_URL}}` (its private address works without SSL, which the server detects), or use Supabase. Generate a domain under Settings > Networking.

`PORT` is set by the host. If the database can't be reached the server stops with a message saying what to check. On the website, set `VITE_ADMIN_URL` (footer Staff login link) and `VITE_ADMIN_API_URL` (published events and enquiries) to the backend's address.

| Command | What it does |
|---|---|
| `npm --prefix Backend/server test` | Server tests (sign-in, permissions for every role, events, publishing, enquiries, sponsors, deals, payments, reports) |
| `npm --prefix Backend/server run smoke` | Calls every API route over real HTTP as each role, against a throwaway in-memory database, and prints one line per call |
| `npm --prefix Frontend/admin test` | Admin app tests |
