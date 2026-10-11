import { describe, expect, it, vi } from 'vitest';
import {
  recordEnquiry,
  buildMailtoUrl,
  buildWhatsAppUrl,
  enquirySubject,
  formatEnquiryText,
  submitEnquiry,
  toWaNumber,
} from './enquiry';
import type { EnquirySubmission } from '../types';

const data: EnquirySubmission = {
  fullName: 'Aisha',
  company: 'Co',
  email: 'a@b.mv',
  phone: '7771234',
  service: 'Sponsorship or exhibition stand',
  timeline: 'Q3/Q4 2026',
  budget: '',
  message: 'Booth please',
  event: 'Build Expo',
};

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('enquirySubject', () => {
  it('names the service and event', () => {
    expect(enquirySubject(data)).toBe('New enquiry: Sponsorship or exhibition stand – Build Expo');
  });

  it('names only the service when there is no event', () => {
    expect(enquirySubject({ ...data, event: undefined })).toBe('New enquiry: Sponsorship or exhibition stand');
  });
});

describe('submitEnquiry', () => {
  it('posts every field to Web3Forms and reports success', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ success: true }));
    expect(await submitEnquiry(data, 'KEY', 'https://medium.mv/contact', fetchImpl)).toEqual({ ok: true });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.web3forms.com/submit');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toMatchObject({
      access_key: 'KEY',
      subject: 'New enquiry: Sponsorship or exhibition stand – Build Expo',
      from_name: 'MEDIUM Website',
      botcheck: false,
      name: 'Aisha',
      company: 'Co',
      email: 'a@b.mv',
      phone: '7771234',
      service: 'Sponsorship or exhibition stand',
      timeline: 'Q3/Q4 2026',
      message: 'Booth please',
      event: 'Build Expo',
      page: 'https://medium.mv/contact',
    });
  });

  it('treats success:false as rejected', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ success: false, message: 'Invalid key' }));
    expect(await submitEnquiry(data, 'KEY', '', fetchImpl)).toEqual({ ok: false, reason: 'rejected' });
  });

  it('treats a non-JSON error page as rejected', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('<html>502 Bad Gateway</html>', { status: 502 }));
    expect(await submitEnquiry(data, 'KEY', '', fetchImpl)).toEqual({ ok: false, reason: 'rejected' });
  });

  it('gives up on a stalled request so the fallbacks can be shown', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })));
    await submitEnquiry(data, 'KEY', '', fetchImpl);
    expect(fetchImpl.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);

    const hanging = vi.fn((_url: string, init: RequestInit) =>
      new Promise((_, reject) => init.signal!.addEventListener('abort', () => reject(init.signal!.reason))),
    );
    expect(await submitEnquiry(data, 'KEY', '', hanging as unknown as typeof fetch, 20)).toEqual({ ok: false, reason: 'network' });
  });

  it('reports network failures', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await submitEnquiry(data, 'KEY', '', fetchImpl)).toEqual({ ok: false, reason: 'network' });
  });
});

describe('contact links', () => {
  it('turns formatted Maldivian numbers into wa.me digits', () => {
    expect(toWaNumber('+960 799-7974')).toBe('9607997974');
    expect(toWaNumber('960 770 1090')).toBe('9607701090');
  });

  it('builds an encoded WhatsApp link', () => {
    expect(buildWhatsAppUrl('+960 799-7974', "Hi & 'hello'")).toBe(
      'https://wa.me/9607997974?text=' + encodeURIComponent("Hi & 'hello'"),
    );
  });

  it('builds a mailto link with %20 spaces and encoded newlines', () => {
    expect(buildMailtoUrl('info@medium.mv', 'S & T', 'line1\nline2')).toBe(
      'mailto:info@medium.mv?subject=S%20%26%20T&body=line1%0Aline2',
    );
  });

  it('includes every filled field in the formatted enquiry text', () => {
    const text = formatEnquiryText(data);
    for (const value of ['Aisha', 'Co', 'a@b.mv', '7771234', 'Build Expo', 'Booth please', 'Q3/Q4 2026']) {
      expect(text).toContain(value);
    }
    expect(text).not.toContain('Budget');
  });
});

describe('recordEnquiry', () => {
  it('posts the enquiry to the MEDIUM admin server', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 201 }));
    expect(await recordEnquiry(data, 'https://admin.medium.mv', fetchImpl)).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://admin.medium.mv/api/public/enquiries');
    expect(init.method).toBe('POST');
    expect(init.keepalive).toBe(true);
    expect(JSON.parse(init.body)).toEqual({
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
    });
  });

  it('never throws when the server is down or refuses', async () => {
    expect(await recordEnquiry(data, 'https://admin.medium.mv', vi.fn().mockRejectedValue(new TypeError('Failed')))).toBe(false);
    expect(await recordEnquiry(data, 'https://admin.medium.mv', vi.fn().mockResolvedValue(new Response('{}', { status: 429 })))).toBe(false);
  });
});
