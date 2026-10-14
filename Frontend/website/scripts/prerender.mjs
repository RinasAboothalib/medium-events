// Renders every route to dist/<path>/index.html with its own head tags, then writes sitemap.xml and robots.txt.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const dist = resolve('dist');
const { render, ROUTES, SITE_URL, NOT_FOUND_TITLE, buildHeadTags, jsonLdForRoute, buildSitemap, buildRobots } = await import(
  pathToFileURL(resolve('dist-ssr/entry-server.js')).href
);

const template = readFileSync(join(dist, 'index.html'), 'utf8');
if (!template.includes('<!--app-head-->') || !template.includes('<!--app-html-->')) {
  throw new Error('index.html is missing the <!--app-head--> or <!--app-html--> marker');
}

for (const route of ROUTES) {
  const head = buildHeadTags(route, SITE_URL, jsonLdForRoute(route, SITE_URL));
  const html = template.replace('<!--app-head-->', () => head).replace('<!--app-html-->', () => render(route.path));
  // Write both /contact/index.html and /contact.html: static hosts differ in which one they serve for /contact
  const files = route.path === '/' ? ['index.html'] : [`${route.path.slice(1)}/index.html`, `${route.path.slice(1)}.html`];
  for (const file of files.map((f) => join(dist, f))) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, html);
  }
}

// Not-found page: static hosts serve dist/404.html for unknown addresses
const notFoundHead = [
  `<title>${NOT_FOUND_TITLE}</title>`,
  '<meta name="robots" content="noindex">',
].join('\n    ');
writeFileSync(
  join(dist, '404.html'),
  template.replace('<!--app-head-->', () => notFoundHead).replace('<!--app-html-->', () => render('/404')),
);

writeFileSync(join(dist, 'sitemap.xml'), buildSitemap(ROUTES, SITE_URL));
writeFileSync(join(dist, 'robots.txt'), buildRobots(SITE_URL));
console.log(`Pre-rendered ${ROUTES.length} pages for ${SITE_URL}`);
