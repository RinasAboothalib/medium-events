import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { WhatsAppButton } from './WhatsAppButton';
import { buildWhatsAppUrl } from '../lib/enquiry';
import { trackEvent } from '../lib/analytics';

vi.mock('../lib/analytics', () => ({ trackEvent: vi.fn() }));

const NUMBER = '+960 799-7974';

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <WhatsAppButton />
    </MemoryRouter>,
  );

const toggle = () => screen.getByRole('button', { name: 'Chat with MEDIUM on WhatsApp' });
const openChat = () => {
  fireEvent.click(toggle());
  return screen.getByRole('dialog', { name: 'Chat with MEDIUM Events' });
};
const messageBox = () => screen.getByRole('textbox', { name: 'Your message' }) as HTMLTextAreaElement;
const sendLink = () => screen.getByRole('link', { name: /Open WhatsApp/ });

beforeEach(() => vi.mocked(trackEvent).mockClear());

describe('WhatsAppButton', () => {
  it('starts closed', () => {
    renderAt('/');
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens a chat panel with a greeting and moves focus to the message box', () => {
    renderAt('/');
    const panel = openChat();
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(within(panel).getByText(/How can we help\?/)).toBeTruthy();
    expect(document.activeElement).toBe(messageBox());
    expect(messageBox().value).toBe("Hi MEDIUM, I'm interested in your events and services.");
  });

  it('starts the message with the series on a series page', () => {
    renderAt('/events/build-expo');
    openChat();
    expect(messageBox().value).toBe("Hi MEDIUM, I'm interested in Build Expo.");
  });

  it('fills the message from a quick topic', () => {
    renderAt('/events/build-expo');
    openChat();
    fireEvent.click(screen.getByRole('button', { name: 'Exhibition stand' }));
    expect(messageBox().value).toBe("Hi MEDIUM, I'd like to book an exhibition stand at Build Expo.");
    fireEvent.click(screen.getByRole('button', { name: 'Advertising or design' }));
    expect(messageBox().value).toBe("Hi MEDIUM, I'd like to talk about an advertising or design project.");
  });

  it('sends the typed message to MEDIUM on WhatsApp and closes', () => {
    renderAt('/');
    openChat();
    fireEvent.change(messageBox(), { target: { value: 'Hello & welcome' } });
    const link = sendLink();
    expect(link.getAttribute('href')).toBe(buildWhatsAppUrl(NUMBER, 'Hello & welcome'));
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    fireEvent.click(link);
    expect(trackEvent).toHaveBeenCalledWith('whatsapp_click', { location: 'floating' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not send an empty message', () => {
    renderAt('/');
    openChat();
    fireEvent.change(messageBox(), { target: { value: '   ' } });
    fireEvent.click(sendLink());
    expect(trackEvent).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Type a message first.')).toBeTruthy();
  });

  it('closes with Escape, the close button or the toggle, returning focus to the toggle', () => {
    renderAt('/');
    openChat();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(toggle());

    openChat();
    fireEvent.click(screen.getByRole('button', { name: 'Close chat' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    openChat();
    fireEvent.click(toggle());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is not shown on the contact page, which has its own WhatsApp options', () => {
    renderAt('/contact');
    expect(screen.queryByRole('button', { name: 'Chat with MEDIUM on WhatsApp' })).toBeNull();
    renderAt('/contact/');
    expect(screen.queryByRole('button', { name: 'Chat with MEDIUM on WhatsApp' })).toBeNull();
  });

  it('shows a brand-coloured focus ring that is visible on white pages', () => {
    renderAt('/');
    const cls = toggle().className;
    expect(cls).toContain('focus-visible:outline-brand');
    expect(cls).not.toContain('ring-white');
  });
});
