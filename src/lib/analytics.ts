// Google Analytics 4. Loads only when VITE_GA_ID is set; every call is a no-op otherwise.
// All tracking goes through this file so a consent banner can be added in one place later.

export type AnalyticsEvent = 'generate_lead' | 'whatsapp_click' | 'contact_click' | 'facebook_event_click';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let measurementId: string | undefined;

export function initAnalytics(id: string | undefined): void {
  if (!id || typeof window === 'undefined' || measurementId) return;
  measurementId = id;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // gtag.js expects the arguments object itself, not an array
    window.dataLayer!.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', id, { send_page_view: false });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);
}

export function trackPageView(path: string, title: string): void {
  if (measurementId) window.gtag?.('event', 'page_view', { page_path: path, page_title: title });
}

export function trackEvent(name: AnalyticsEvent, params: Record<string, string>): void {
  if (measurementId) window.gtag?.('event', name, params);
}
