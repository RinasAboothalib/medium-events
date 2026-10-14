// Prebuild step: downloads the events MEDIUM published from the admin (GET <VITE_ADMIN_API_URL>/api/public/site-data)
// into src/data/published.json, and their banners into public/images/cms/. The site uses that data when present and
// its built-in data otherwise. A failed download never fails the build: the previous data (or built-in data) is kept.
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const FILE_PATH = /^\/api\/public\/files\/([0-9a-f-]{36})$/;

export async function fetchSiteData({ apiUrl, outFile, imageDir, fetch }) {
  const base = (apiUrl ?? '').trim().replace(/\/+$/, '');
  if (!base) {
    rmSync(outFile, { force: true });
    return 'skipped';
  }
  try {
    const res = await fetch(`${base}/api/public/site-data`);
    if (res.status === 404) {
      rmSync(outFile, { force: true });
      console.log('No events published from the admin yet; using built-in event data.');
      return 'skipped';
    }
    if (!res.ok) throw new Error(`site data request returned ${res.status}`);
    const data = await res.json();

    // Download every banner first, so a half-finished run never leaves the site pointing at missing images
    const images = new Map();
    for (const event of [...(data.events ?? []), ...(data.upcoming ?? [])]) {
      const match = FILE_PATH.exec(event.image ?? '');
      if (!match || images.has(event.image)) continue;
      const img = await fetch(`${base}${event.image}`);
      if (!img.ok) throw new Error(`image ${match[1]} returned ${img.status}`);
      const ext = EXTENSIONS[(img.headers.get('content-type') ?? '').split(';')[0]] ?? 'jpg';
      images.set(event.image, { name: `${match[1]}.${ext}`, bytes: new Uint8Array(await img.arrayBuffer()) });
    }

    mkdirSync(imageDir, { recursive: true });
    for (const { name, bytes } of images.values()) writeFileSync(join(imageDir, name), bytes);
    for (const event of [...(data.events ?? []), ...(data.upcoming ?? [])]) {
      if (images.has(event.image)) event.image = `/images/cms/${images.get(event.image).name}`;
    }
    mkdirSync(dirname(outFile), { recursive: true });
    writeFileSync(outFile, JSON.stringify(data, null, 2) + '\n');
    console.log(`Using published event data from ${base} (${data.events?.length ?? 0} events).`);
    return 'written';
  } catch (error) {
    console.warn(`Couldn't fetch published event data from ${base} (${error.message}). ${existsSync(outFile) ? 'Keeping the previous data.' : 'Using built-in event data.'}`);
    return 'failed';
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  // Same .env files Vite reads, so VITE_ADMIN_API_URL can live in .env
  try {
    const { loadEnv } = await import('vite');
    Object.assign(process.env, { ...loadEnv('production', root, 'VITE_'), ...process.env });
  } catch {}
  await fetchSiteData({
    apiUrl: process.env.VITE_ADMIN_API_URL,
    outFile: join(root, 'src', 'data', 'published.json'),
    imageDir: join(root, 'public', 'images', 'cms'),
    fetch: globalThis.fetch,
  });
}
