import { beforeEach, describe, expect, it, vi } from 'vitest';

type AnalyticsModule = typeof import('./analytics');
let analytics: AnalyticsModule;

const gaScripts = () => document.querySelectorAll('script[src*="googletagmanager.com/gtag/js"]');
const dataLayer = () => ((window as any).dataLayer ?? []).map((args: IArguments) => Array.from(args));

beforeEach(async () => {
  document.head.innerHTML = '';
  delete (window as any).dataLayer;
  delete (window as any).gtag;
  vi.resetModules();
  analytics = await import('./analytics');
});

describe('analytics', () => {
  it('loads nothing without a measurement ID', () => {
    analytics.initAnalytics(undefined);
    expect(gaScripts()).toHaveLength(0);
    expect(() => analytics.trackEvent('whatsapp_click', { location: 'floating' })).not.toThrow();
    expect((window as any).dataLayer).toBeUndefined();
  });

  it('injects the GA4 script exactly once', () => {
    analytics.initAnalytics('G-TEST');
    analytics.initAnalytics('G-TEST');
    expect(gaScripts()).toHaveLength(1);
    expect((gaScripts()[0] as HTMLScriptElement).src).toMatch(/id=G-TEST$/);
    expect(dataLayer()).toContainEqual(['config', 'G-TEST', { send_page_view: false }]);
  });

  it('records events and page views after init', () => {
    analytics.initAnalytics('G-TEST');
    analytics.trackEvent('whatsapp_click', { location: 'floating' });
    analytics.trackPageView('/events', 'Flagship Events');
    expect(dataLayer()).toContainEqual(['event', 'whatsapp_click', { location: 'floating' }]);
    expect(dataLayer()).toContainEqual(['event', 'page_view', { page_path: '/events', page_title: 'Flagship Events' }]);
  });
});
