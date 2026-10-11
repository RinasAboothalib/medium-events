import { normalizeSiteUrl } from '../config';
import type { RouteMeta } from '../routes';

export function buildSitemap(routes: RouteMeta[], siteUrl: string): string {
  const base = normalizeSiteUrl(siteUrl);
  const urls = routes.map((r) => `  <url>\n    <loc>${base}${r.path}</loc>\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function buildRobots(siteUrl: string): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${normalizeSiteUrl(siteUrl)}/sitemap.xml\n`;
}
