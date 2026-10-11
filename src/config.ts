// Deployment settings, read from VITE_* env vars at build time (see .env.example)

const DEFAULT_SITE_URL = 'https://medium.mv';

export function normalizeSiteUrl(raw: string | undefined): string {
  const value = raw?.trim();
  return (value || DEFAULT_SITE_URL).replace(/\/+$/, '');
}

const optional = (value: string | undefined) => value?.trim() || undefined;

// Staff admin app (separate deployment); the footer's Staff login link points here
export function normalizeAdminUrl(raw: string | undefined): string {
  return (optional(raw) ?? 'http://localhost:3010').replace(/\/+$/, '');
}

export const SITE_URL = normalizeSiteUrl(import.meta.env.VITE_SITE_URL);
export const WEB3FORMS_KEY = optional(import.meta.env.VITE_WEB3FORMS_KEY);
export const GA_ID = optional(import.meta.env.VITE_GA_ID);
export const ADMIN_URL = normalizeAdminUrl(import.meta.env.VITE_ADMIN_URL);
// MEDIUM admin server: published events at build time, and enquiries recorded from the form
export const ADMIN_API_URL = optional(import.meta.env.VITE_ADMIN_API_URL)?.replace(/\/+$/, '');
