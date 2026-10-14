import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter } from 'react-router';
import { EnquiryForm } from './EnquiryForm';
import { SERVICE_OPTIONS } from '../data/websiteData';
import { trackEvent } from '../lib/analytics';

vi.mock('../lib/analytics', () => ({ trackEvent: vi.fn() }));

const mockConfig = vi.hoisted(() => ({ key: undefined as string | undefined, adminApi: undefined as string | undefined }));
vi.mock('../config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../config')>()),
  get WEB3FORMS_KEY() {
    return mockConfig.key;
  },
  get ADMIN_API_URL() {
    return mockConfig.adminApi;
  },
}));

function renderForm(url = '/contact') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <EnquiryForm />
    </MemoryRouter>,
  );
}

function fillRequired() {
  fireEvent.change(screen.getByLabelText(/^Full name/), { target: { value: 'Aisha' } });
  fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'aisha@co.mv' } });
  fireEvent.change(screen.getByLabelText(/^Phone/), { target: { value: '7771234' } });
  fireEvent.change(screen.getByLabelText(/^Your message/), {
    target: { value: 'We would like a booth at Build Expo.' },
  });
}

beforeEach(() => {
  mockConfig.key = undefined;
  mockConfig.adminApi = undefined;
  vi.mocked(trackEvent).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('EnquiryForm without a Web3Forms key', () => {
  it('offers WhatsApp as the primary action and email as the secondary one', () => {
    renderForm();
    fillRequired();
    expect(screen.getByRole('button', { name: /Send via WhatsApp/ })).toBeTruthy();
    const email = screen.getByRole('link', { name: /Send by email/ });
    expect(email.getAttribute('href')).toMatch(/^mailto:info@medium\.mv\?subject=New%20enquiry/);
    expect(decodeURIComponent(email.getAttribute('href')!)).toContain('We would like a booth at Build Expo.');
  });

  it('opens WhatsApp with the enquiry after validation', () => {
    const open = vi.fn();
    vi.stubGlobal('open', open);
    renderForm();
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: /Send via WhatsApp/ }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][0]).toMatch(/^https:\/\/wa\.me\/9607997974\?text=/);
  });

  it('does not open WhatsApp when required fields are missing', () => {
    const open = vi.fn();
    vi.stubGlobal('open', open);
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: /Send via WhatsApp/ }));
    expect(open).not.toHaveBeenCalled();
    expect(screen.getByText('Enter your full name.')).toBeTruthy();
  });
});

describe('EnquiryForm with a Web3Forms key', () => {
  beforeEach(() => {
    mockConfig.key = 'TEST-KEY';
  });

  it('shows an honest confirmation after a successful send', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }))));
    renderForm();
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: /Send enquiry/i }));
    expect(await screen.findByText('Thanks, Aisha. MEDIUM will be in touch within 1 business day.')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/MED-\d{6}/);
    expect(trackEvent).toHaveBeenCalledWith('generate_lead', { service: 'General enquiry', event: '' });
  });

  it('keeps the typed enquiry and offers WhatsApp and email when sending fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    renderForm();
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: /Send enquiry/i }));

    const whatsapp = await screen.findByRole('link', { name: /Send on WhatsApp instead/ });
    expect(whatsapp.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/9607997974\?text=/);
    expect(screen.getByRole('link', { name: /Send by email instead/ }).getAttribute('href')).toMatch(/^mailto:info@medium\.mv/);
    expect((screen.getByLabelText(/^Your message/) as HTMLTextAreaElement).value).toBe(
      'We would like a booth at Build Expo.',
    );
    expect(trackEvent).not.toHaveBeenCalledWith('generate_lead', expect.anything());
  });
});

describe('EnquiryForm recording enquiries in the MEDIUM admin', () => {
  const adminCalls = (fetch: ReturnType<typeof vi.fn>) => fetch.mock.calls.filter(([url]) => String(url).startsWith('https://admin.medium.mv'));

  it('records the enquiry as well as sending it by email', async () => {
    mockConfig.key = 'TEST-KEY';
    mockConfig.adminApi = 'https://admin.medium.mv';
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })));
    vi.stubGlobal('fetch', fetch);
    renderForm();
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: /Send enquiry/i }));
    expect(await screen.findByText('Thanks, Aisha. MEDIUM will be in touch within 1 business day.')).toBeTruthy();
    expect(adminCalls(fetch)).toHaveLength(1);
    expect(JSON.parse(adminCalls(fetch)[0][1].body)).toEqual(expect.objectContaining({ name: 'Aisha', email: 'aisha@co.mv', phone: '7771234' }));
  });

  it('records the enquiry when it goes out over WhatsApp', () => {
    mockConfig.adminApi = 'https://admin.medium.mv';
    const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 201 }));
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('open', vi.fn());
    renderForm();
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: /Send via WhatsApp/ }));
    expect(adminCalls(fetch)).toHaveLength(1);
  });

  it('still confirms to the visitor when the admin server is down', async () => {
    mockConfig.key = 'TEST-KEY';
    mockConfig.adminApi = 'https://admin.medium.mv';
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => (url.startsWith('https://admin.medium.mv') ? Promise.reject(new TypeError('down')) : Promise.resolve(new Response(JSON.stringify({ success: true }))))),
    );
    renderForm();
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: /Send enquiry/i }));
    expect(await screen.findByText('Thanks, Aisha. MEDIUM will be in touch within 1 business day.')).toBeTruthy();
  });

  it('does not contact an admin server when none is configured', async () => {
    mockConfig.key = 'TEST-KEY';
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })));
    vi.stubGlobal('fetch', fetch);
    renderForm();
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: /Send enquiry/i }));
    await screen.findByText('Thanks, Aisha. MEDIUM will be in touch within 1 business day.');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('EnquiryForm enquiry types', () => {
  it('offers exactly the site enquiry types', () => {
    renderForm();
    const select = screen.getByLabelText(/^Enquiry type/) as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual(SERVICE_OPTIONS.map((o) => o.label));
  });

  it('selects sponsorship from the header button link', () => {
    renderForm('/contact?service=sponsorship');
    expect((screen.getByLabelText(/^Enquiry type/) as HTMLSelectElement).value).toBe('Sponsorship or exhibition stand');
  });

  it('selects a service from a services page link', () => {
    renderForm('/contact?service=design');
    expect((screen.getByLabelText(/^Enquiry type/) as HTMLSelectElement).value).toBe('Design and production');
  });
});

describe('EnquiryForm prefill and spam protection', () => {
  it('selects sponsorship and names the event from the URL', async () => {
    renderForm('/contact?event=Aviation%20Forum%20%E2%80%93%20Connecting%20Maldives%20(AF)');
    const select = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    expect(select.value).toBe('Sponsorship or exhibition stand');
    const message = screen.getByLabelText(/^Your message/) as HTMLTextAreaElement;
    expect(message.value).toContain('Aviation Forum – Connecting Maldives (AF)');
  });

  it('has a hidden botcheck honeypot that people cannot tab into', () => {
    const { container } = renderForm();
    const honeypot = container.querySelector('input[name="botcheck"]') as HTMLInputElement;
    expect(honeypot).toBeTruthy();
    expect(honeypot.tabIndex).toBe(-1);
    expect(honeypot.closest('[aria-hidden="true"]')).toBeTruthy();
  });
});

describe('EnquiryForm review fixes', () => {
  beforeEach(() => {
    mockConfig.key = 'TEST-KEY';
  });

  it('offers a WhatsApp chat link on the contact page even when email delivery is configured', () => {
    renderForm();
    const link = screen.getByRole('link', { name: /Chat on WhatsApp/ });
    expect(link.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/9607997974\?text=/);
  });

  it('drops submissions that tick the honeypot without sending them', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { container } = renderForm();
    fillRequired();
    fireEvent.click(container.querySelector('input[name="botcheck"]')!);
    fireEvent.click(screen.getByRole('button', { name: /Send enquiry/i }));
    expect(await screen.findByText(/MEDIUM will be in touch/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forgets the event when the visitor switches to a plain sponsorship enquiry', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })));
    vi.stubGlobal('fetch', fetchMock);
    render(
      <MemoryRouter initialEntries={['/contact?event=Build%20Expo']}>
        <Link to="/contact?service=sponsorship">switch</Link>
        <EnquiryForm />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('link', { name: 'switch' }));
    fireEvent.change(screen.getByLabelText(/^Full name/), { target: { value: 'Aisha' } });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'aisha@co.mv' } });
    fireEvent.change(screen.getByLabelText(/^Phone/), { target: { value: '7771234' } });
    fireEvent.change(screen.getByLabelText(/^Your message/), { target: { value: 'General sponsorship question.' } });
    fireEvent.click(screen.getByRole('button', { name: /Send enquiry/i }));
    await screen.findByText(/MEDIUM will be in touch/);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.event).toBe('');
    expect(body.subject).toBe('New enquiry: Sponsorship or exhibition stand');
  });
});
