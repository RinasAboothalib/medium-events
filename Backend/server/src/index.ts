// Starts the MEDIUM admin API: opens the database, applies migrations, creates the default admin
// on first run, and listens on PORT.
import 'dotenv/config';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, type Db } from './db/index.js';
import { migrate } from './db/migrate.js';
import { createApp } from './app.js';
import { DEFAULT_ADMIN_EMAIL, defaultAdminPending, ensureDefaultAdmin } from './bootstrap.js';
import { seedEvents } from './seed.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const production = process.env.NODE_ENV === 'production';
const url = process.env.DATABASE_URL?.trim() || undefined;
const dataDir = join(root, '.data', 'pg');
if (!url) mkdirSync(dataDir, { recursive: true });

if (production && !url) {
  console.warn(
    'WARNING: DATABASE_URL is not set, so data is kept in Backend/server/.data on this machine. ' +
      'Most hosts wipe that folder on every deploy or restart: set DATABASE_URL (e.g. Supabase) to keep your data.',
  );
}

let db: Db;
try {
  db = await openDb({ url, dataDir });
  const applied = await migrate(db, join(root, 'migrations'));
  if (applied.length) console.log(`Applied migrations: ${applied.join(', ')}`);
} catch (e) {
  // The usual deployment failure: say what to check instead of only a stack trace
  console.error(`Could not open the database (${url ? 'DATABASE_URL' : `local database in ${dataDir}`}): ${(e as Error).message}`);
  if (url) {
    console.error(
      'Check DATABASE_URL: for Supabase use the Session pooler connection string (port 5432, user postgres.<project-ref>) with your database password; ' +
        'the direct db.<ref>.supabase.co address only works over IPv6, which many hosts lack. ' +
        'For a database without SSL, add ?sslmode=disable to the URL.',
    );
  }
  process.exit(1);
}

if ((await seedEvents(db, join(root, 'seed'))) === 'seeded') console.log("Loaded MEDIUM's event series and past editions");

if ((await ensureDefaultAdmin(db, process.env.DEFAULT_ADMIN_PASSWORD?.trim())) === 'created') {
  console.log(`Created the default admin: ${DEFAULT_ADMIN_EMAIL}`);
}
if (await defaultAdminPending(db)) {
  console.warn(`WARNING: ${DEFAULT_ADMIN_EMAIL} still uses the default password. Sign in and change it.`);
}

const port = Number(process.env.PORT ?? 3020);
// In production the server also serves the built admin app (npm --prefix Frontend/admin run build)
const adminDist = join(root, '..', '..', 'Frontend', 'admin', 'dist');
const serveAdmin = production && existsSync(join(adminDist, 'index.html'));
if (production && !serveAdmin) {
  console.warn(`WARNING: the admin app isn't built (${adminDist} is missing), so only /api is served. Build it with: npm run build:backend (from the repository root).`);
}

// The website that may send enquiries from the browser. In development the website's own dev server
// (port 3000) and preview (port 4173) are allowed unless PUBLIC_SITE_ORIGIN says otherwise.
const publicSiteOrigin = process.env.PUBLIC_SITE_ORIGIN?.trim() || (production ? undefined : 'http://localhost:3000, http://localhost:4173');
if (production && !publicSiteOrigin) {
  console.warn('WARNING: PUBLIC_SITE_ORIGIN is not set, so browsers will block enquiries sent from the website. Set it to the website address, e.g. https://medium.mv');
}

createApp({
  db,
  adminDist: serveAdmin ? adminDist : undefined,
  config: {
    publicSiteOrigin,
    deployHookUrl: process.env.SITE_DEPLOY_HOOK_URL?.trim() || undefined,
  },
}).listen(port, () => {
  console.log(`MEDIUM admin API on http://localhost:${port} (${url ? 'Postgres via DATABASE_URL' : `local database in ${dataDir}`})`);
});
