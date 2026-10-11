// Starts the MEDIUM admin API: opens the database, applies migrations, creates the default admin
// on first run, and listens on PORT.
import 'dotenv/config';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db/index.js';
import { migrate } from './db/migrate.js';
import { createApp } from './app.js';
import { DEFAULT_ADMIN_EMAIL, defaultAdminPending, ensureDefaultAdmin } from './bootstrap.js';
import { seedEvents } from './seed.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = process.env.DATABASE_URL?.trim() || undefined;
const dataDir = join(root, '.data', 'pg');
if (!url) mkdirSync(dataDir, { recursive: true });

const db = await openDb({ url, dataDir });
const applied = await migrate(db, join(root, 'migrations'));
if (applied.length) console.log(`Applied migrations: ${applied.join(', ')}`);
if ((await seedEvents(db, join(root, 'seed'))) === 'seeded') console.log("Loaded MEDIUM's event series and past editions");

if ((await ensureDefaultAdmin(db, process.env.DEFAULT_ADMIN_PASSWORD?.trim())) === 'created') {
  console.log(`Created the default admin: ${DEFAULT_ADMIN_EMAIL}`);
}
if (await defaultAdminPending(db)) {
  console.warn(`WARNING: ${DEFAULT_ADMIN_EMAIL} still uses the default password. Sign in and change it.`);
}

const port = Number(process.env.PORT ?? 3020);
// In production the server also serves the built admin app (npm --prefix admin run build)
const adminDist = join(root, '..', 'admin', 'dist');

createApp({
  db,
  adminDist: process.env.NODE_ENV === 'production' && existsSync(join(adminDist, 'index.html')) ? adminDist : undefined,
  config: {
    publicSiteOrigin: process.env.PUBLIC_SITE_ORIGIN?.trim() || undefined,
    deployHookUrl: process.env.SITE_DEPLOY_HOOK_URL?.trim() || undefined,
  },
}).listen(port, () => {
  console.log(`MEDIUM admin API on http://localhost:${port} (${url ? 'Postgres via DATABASE_URL' : `local database in ${dataDir}`})`);
});
