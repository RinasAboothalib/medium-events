// Fails the build if any pre-rendered page is missing the metadata that search and social previews need.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const pageFile = (distDir, path) => join(distDir, path === '/' ? 'index.html' : `${path.replace(/^\//, '')}/index.html`);
const attr = (html, pattern) => html.match(pattern)?.[1]?.trim() ?? '';

export function checkBuild(distDir, routes) {
  const problems = [];
  const titles = new Map();

  for (const { path } of routes) {
    const file = pageFile(distDir, path);
    if (!existsSync(file)) {
      problems.push(`${path}: missing ${file}`);
      continue;
    }
    const html = readFileSync(file, 'utf8');
    const title = attr(html, /<title>([^<]*)<\/title>/);

    if (!title) problems.push(`${path}: missing <title>`);
    else if (titles.has(title)) problems.push(`${path}: duplicate title "${title}" (also on ${titles.get(title)})`);
    else titles.set(title, path);

    if (!attr(html, /<meta name="description" content="([^"]*)"/)) problems.push(`${path}: missing meta description`);
    if (!attr(html, /<link rel="canonical" href="([^"]*)"/)) problems.push(`${path}: missing canonical link`);
    if (!/^https?:\/\//.test(attr(html, /<meta property="og:image" content="([^"]*)"/)))
      problems.push(`${path}: og:image missing or not an absolute URL`);
    if (!attr(html, /<div id="root">([\s\S]*?)<\/div>\s*(?:<script|<\/body>)/)) problems.push(`${path}: empty app root (not pre-rendered)`);
  }

  const notFound = join(distDir, '404.html');
  if (!existsSync(notFound)) problems.push('missing 404.html');
  else if (!/<meta name="robots" content="noindex"/.test(readFileSync(notFound, 'utf8'))) problems.push('404.html must be noindex');

  for (const file of ['sitemap.xml', 'robots.txt']) {
    if (!existsSync(join(distDir, file))) problems.push(`missing ${file}`);
  }
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { ROUTES } = await import(pathToFileURL(resolve('dist-ssr/entry-server.js')).href);
  const problems = checkBuild(resolve('dist'), ROUTES);
  if (problems.length) {
    console.error(`Build check failed:\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`Build check passed: ${ROUTES.length} pages, sitemap.xml, robots.txt`);
}
