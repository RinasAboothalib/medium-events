import { describe, expect, it } from 'vitest';
import { ROUTES } from '../routes';
import { COMPANY_DETAILS, PAST_EVENTS_DATA } from '../data/websiteData';
import { buildHeadTags } from './headTags';
import { jsonLdForRoute, organizationJsonLd, pastEventsJsonLd } from './structuredData';
import { buildRobots, buildSitemap } from './sitemap';

const events = ROUTES.find((r) => r.id === 'events')!;

describe('buildHeadTags', () => {
  it('emits canonical, absolute og:image and twitter card for a route', () => {
    const head = buildHeadTags(events, 'https://medium.mv/', jsonLdForRoute(events, 'https://medium.mv'));
    expect(head).toContain(`<title>${events.title}</title>`);
    expect(head).toContain('<link rel="canonical" href="https://medium.mv/events">');
    expect(head).toContain('<meta property="og:url" content="https://medium.mv/events">');
    expect(head).toContain('<meta property="og:image" content="https://medium.mv/images/fb/cif-2025.jpg">');
    expect(head).toContain('<meta property="og:image:width" content="960">');
    expect(head).toContain('<meta property="og:image:height" content="453">');
    expect(head).toContain('<meta property="og:site_name" content="MEDIUM Events">');
    expect(head).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(head).toContain('<script type="application/ld+json">');
  });

  it('never produces a double slash when the site URL has a trailing slash', () => {
    const head = buildHeadTags(events, 'https://medium.mv/', []);
    expect(head).not.toMatch(/https:\/\/medium\.mv\/\//);
  });

  it('uses the bare site URL as the home canonical', () => {
    expect(buildHeadTags(ROUTES[0], 'https://medium.mv', [])).toContain('<link rel="canonical" href="https://medium.mv/">');
  });

  it('escapes HTML in titles and descriptions', () => {
    const head = buildHeadTags({ ...events, title: 'A & "B" <C>' }, 'https://medium.mv', []);
    expect(head).toContain('<title>A &amp; &quot;B&quot; &lt;C&gt;</title>');
  });

  it('keeps JSON-LD from closing the script tag', () => {
    const head = buildHeadTags(events, 'https://medium.mv', [{ name: '</script><b>' }]);
    expect(head).not.toContain('</script><b>');
  });
});

describe('structured data', () => {
  it('describes MEDIUM as an Organization linked to its social profiles', () => {
    const org = organizationJsonLd('https://medium.mv') as Record<string, any>;
    expect(org['@type']).toBe('Organization');
    expect(org.name).toBe('MEDIUM Events Pvt Ltd');
    expect(org.url).toBe('https://medium.mv/');
    expect(org.email).toBe(COMPANY_DETAILS.inquiryEmail);
    expect(org.sameAs).toEqual([
      COMPANY_DETAILS.social.facebook,
      COMPANY_DETAILS.social.instagram,
      COMPANY_DETAILS.social.linkedin,
    ]);
    expect(org.address).toMatchObject({ '@type': 'PostalAddress', addressCountry: 'MV' });
  });

  it('describes every past event as a schema.org Event', () => {
    const evs = pastEventsJsonLd('https://medium.mv') as Record<string, any>[];
    expect(evs).toHaveLength(PAST_EVENTS_DATA.length);
    expect(evs[0]).toMatchObject({
      '@type': 'Event',
      name: PAST_EVENTS_DATA[0].name,
      startDate: PAST_EVENTS_DATA[0].isoDate,
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      image: `https://medium.mv${PAST_EVENTS_DATA[0].image}`,
    });
    expect(evs[0].location).toMatchObject({ '@type': 'Place', name: PAST_EVENTS_DATA[0].venue });
  });

  it('adds only that series\' editions on a series page', () => {
    const cif = ROUTES.find((r) => r.seriesSlug === 'construction-industry-forum')!;
    const data = jsonLdForRoute(cif, 'https://medium.mv') as Record<string, any>[];
    expect(data).toHaveLength(4);
    expect(data[0]['@type']).toBe('Organization');
    for (const event of data.slice(1)) expect(event.name).toContain('Construction Industry Forum');
  });

  it('adds events only on the events page', () => {
    expect(jsonLdForRoute(ROUTES[0], 'https://medium.mv')).toHaveLength(1);
    expect(jsonLdForRoute(events, 'https://medium.mv')).toHaveLength(1 + PAST_EVENTS_DATA.length);
  });
});

describe('sitemap and robots', () => {
  it('lists every route with the normalized site URL', () => {
    const sm = buildSitemap(ROUTES, 'https://medium.mv/');
    expect(sm.startsWith('<?xml')).toBe(true);
    expect(sm.match(/<loc>/g)).toHaveLength(ROUTES.length);
    expect(sm).toContain('<loc>https://medium.mv/</loc>');
    expect(sm).toContain('<loc>https://medium.mv/news</loc>');
    expect(sm).not.toMatch(/medium\.mv\/\//);
  });

  it('points robots at the sitemap', () => {
    const robots = buildRobots('https://medium.mv/');
    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Allow: /');
    expect(robots).toContain('Sitemap: https://medium.mv/sitemap.xml');
  });

  it('declares image dimensions for every page share image', () => {
    for (const route of ROUTES) {
      const head = buildHeadTags(route, 'https://medium.mv', []);
      expect(head, route.path).toMatch(/og:image:width" content="\d+"/);
      expect(head, route.path).toMatch(/og:image:height" content="\d+"/);
    }
  });
});
