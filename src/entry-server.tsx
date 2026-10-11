// Build-time entry: scripts/prerender.mjs imports this bundle to render every route to static HTML.
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { AppRoutes } from './AppRoutes';

export { ROUTES } from './routes';
export { NOT_FOUND_TITLE } from './pages/NotFoundPage';
export { SITE_URL } from './config';
export { buildHeadTags } from './seo/headTags';
export { jsonLdForRoute } from './seo/structuredData';
export { buildSitemap, buildRobots } from './seo/sitemap';

export function render(url: string): string {
  return renderToString(
    <StaticRouter location={url}>
      <AppRoutes />
    </StaticRouter>,
  );
}
