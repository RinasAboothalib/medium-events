import { normalizeSiteUrl } from '../config';
import type { RouteMeta } from '../routes';

// Pixel sizes of share images, so Facebook can render the preview before downloading it
const OG_IMAGE_SIZES: Record<string, [number, number]> = {
  '/images/fb/cif-2025.jpg': [960, 453],
  '/images/fb/ooredoo-cif-2026-signing.jpg': [2048, 1365],
  '/images/fb/mmif-2025.jpg': [960, 453],
  '/images/fb/aviation-forum-2026.jpg': [960, 540],
  '/images/fb/build-expo-2025.jpg': [960, 381],
};

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function buildHeadTags(route: RouteMeta, siteUrl: string, jsonLd: object[]): string {
  const base = normalizeSiteUrl(siteUrl);
  const url = `${base}${route.path}`;
  const image = `${base}${route.ogImage}`;
  const title = escapeHtml(route.title);
  const description = escapeHtml(route.description);
  const size = OG_IMAGE_SIZES[route.ogImage];

  const tags = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}">`,
    `<link rel="canonical" href="${url}">`,
    `<meta property="og:site_name" content="MEDIUM Events">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${image}">`,
    ...(size
      ? [
          `<meta property="og:image:width" content="${size[0]}">`,
          `<meta property="og:image:height" content="${size[1]}">`,
        ]
      : []),
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${description}">`,
    `<meta name="twitter:image" content="${image}">`,
    ...jsonLd.map(
      (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`,
    ),
  ];

  return tags.join('\n    ');
}
