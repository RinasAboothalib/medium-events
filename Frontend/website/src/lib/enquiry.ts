import type { EnquirySubmission } from '../types';

// Delivers enquiries to MEDIUM's inbox via Web3Forms, plus WhatsApp/email links used as fallbacks.

const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';
const DEFAULT_TIMEOUT_MS = 15000;

export type SubmitResult = { ok: true } | { ok: false; reason: 'network' | 'rejected' };

export function enquirySubject(data: EnquirySubmission): string {
  return data.event ? `New enquiry: ${data.service} – ${data.event}` : `New enquiry: ${data.service}`;
}

export async function submitEnquiry(
  data: EnquirySubmission,
  key: string,
  pageUrl: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<SubmitResult> {
  let response: Response;
  try {
    response = await fetchImpl(WEB3FORMS_ENDPOINT, {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: key,
        subject: enquirySubject(data),
        from_name: 'MEDIUM Website',
        botcheck: false,
        name: data.fullName,
        company: data.company,
        email: data.email,
        phone: data.phone,
        service: data.service,
        timeline: data.timeline,
        budget: data.budget ?? '',
        message: data.message,
        event: data.event ?? '',
        page: pageUrl,
      }),
    });
  } catch {
    return { ok: false, reason: 'network' };
  }

  try {
    const body = await response.json();
    return body?.success === true ? { ok: true } : { ok: false, reason: 'rejected' };
  } catch {
    return { ok: false, reason: 'rejected' };
  }
}

// Also records the enquiry in the MEDIUM admin (Enquiries), when VITE_ADMIN_API_URL is set.
// Best effort: it never throws, and the visitor's experience never depends on it.
export async function recordEnquiry(data: EnquirySubmission, apiUrl: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    const response = await fetchImpl(`${apiUrl}/api/public/enquiries`, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.fullName,
        company: data.company,
        email: data.email,
        phone: data.phone,
        service: data.service,
        event: data.event ?? '',
        timeline: data.timeline,
        budget: data.budget ?? '',
        message: data.message,
        botcheck: '',
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function formatEnquiryText(data: EnquirySubmission): string {
  const lines: [string, string | undefined][] = [
    ['Name', data.fullName],
    ['Company', data.company],
    ['Email', data.email],
    ['Phone', data.phone],
    ['Service', data.service],
    ['Event', data.event],
    ['Timeline', data.timeline],
    ['Budget', data.budget],
  ];
  const details = lines.filter(([, value]) => value?.trim()).map(([label, value]) => `${label}: ${value}`);
  return [`Hi MEDIUM, I'd like to make an enquiry.`, '', ...details, '', data.message].join('\n');
}

export function toWaNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function buildWhatsAppUrl(phone: string, text: string): string {
  return `https://wa.me/${toWaNumber(phone)}?text=${encodeURIComponent(text)}`;
}

export function buildMailtoUrl(to: string, subject: string, body: string): string {
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
