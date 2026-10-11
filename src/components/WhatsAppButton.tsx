import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { Send, X } from 'lucide-react';
import { COMPANY_DETAILS, seriesBySlug } from '../data/websiteData';
import { buildWhatsAppUrl } from '../lib/enquiry';
import { routeForPath } from '../routes';
import { trackEvent } from '../lib/analytics';
import { MediumMark } from './Logo';
import { WhatsAppIcon } from './WhatsAppIcon';

// Quick topics; `series` is the event series the visitor is looking at, if any
const TOPICS: { label: string; message: (series?: string) => string }[] = [
  {
    label: 'Sponsorship',
    message: (series) => `Hi MEDIUM, I'd like to discuss sponsorship of ${series ?? 'one of your events'}.`,
  },
  {
    label: 'Exhibition stand',
    message: (series) => `Hi MEDIUM, I'd like to book an exhibition stand${series ? ` at ${series}` : ''}.`,
  },
  { label: 'Advertising or design', message: () => "Hi MEDIUM, I'd like to talk about an advertising or design project." },
  { label: 'Something else', message: () => 'Hi MEDIUM, I have a question: ' },
];

// Floating WhatsApp chat: a small panel to pick a topic and write a message, then hand off to
// WhatsApp. Not shown on the contact page, where it would cover the form's submit button and the
// page already offers WhatsApp.
export const WhatsAppButton: React.FC = () => {
  const { pathname } = useLocation();
  const route = routeForPath(pathname);
  const series = route?.seriesSlug ? seriesBySlug(route.seriesSlug)?.name : undefined;
  const greeting = series ? `Hi MEDIUM, I'm interested in ${series}.` : "Hi MEDIUM, I'm interested in your events and services.";

  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(greeting);
  const [error, setError] = useState('');
  const toggleRef = useRef<HTMLButtonElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) toggleRef.current?.focus();
  };

  const openPanel = () => {
    setMessage(greeting);
    setError('');
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    messageRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Close when the visitor navigates to another page
  useEffect(() => setOpen(false), [pathname]);

  if (route?.id === 'contact') return null;

  const send = (e: React.MouseEvent) => {
    if (!message.trim()) {
      e.preventDefault();
      setError('Type a message first.');
      messageRef.current?.focus();
      return;
    }
    trackEvent('whatsapp_click', { location: 'floating' });
    close(false);
  };

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="Chat with MEDIUM Events"
          className="fixed right-4 sm:right-5 bottom-24 z-40 w-[calc(100vw-2rem)] sm:w-[360px] rounded-xl border border-line bg-white shadow-xl overflow-hidden"
        >
          <div className="flex items-center gap-3 bg-[#075E54] px-4 py-3 text-white">
            <MediumMark size={36} />
            <div className="flex-grow">
              <p className="text-sm font-semibold">MEDIUM Events</p>
              <p className="text-xs text-white/80">We reply on WhatsApp</p>
            </div>
            <button
              type="button"
              onClick={() => close()}
              aria-label="Close chat"
              className="rounded-md p-1.5 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-[#ECE5DD] px-4 py-4 space-y-3">
            <p className="max-w-[85%] rounded-lg rounded-tl-none bg-white px-3 py-2 text-sm text-ink shadow-sm">
              Hi there! How can we help? Choose a topic or type your message.
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Quick topics">
              {TOPICS.map((topic) => (
                <button
                  key={topic.label}
                  type="button"
                  onClick={() => {
                    setMessage(topic.message(series));
                    setError('');
                    messageRef.current?.focus();
                  }}
                  className="rounded-full border border-[#075E54]/30 bg-white px-3 py-1.5 text-xs font-medium text-[#075E54] hover:bg-[#075E54] hover:text-white focus-visible:outline-2 focus-visible:outline-[#075E54] cursor-pointer"
                >
                  {topic.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-line p-3">
            <label htmlFor="whatsapp-message" className="sr-only">
              Your message
            </label>
            <textarea
              id="whatsapp-message"
              ref={messageRef}
              rows={3}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                if (error) setError('');
              }}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? 'whatsapp-message-error' : undefined}
              className="w-full resize-none rounded-md border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-[#075E54]/30 focus:border-[#075E54]"
            />
            {error && (
              <p id="whatsapp-message-error" className="mt-1 text-xs text-red-700">
                {error}
              </p>
            )}
            <a
              href={buildWhatsAppUrl(COMPANY_DETAILS.whatsapp, message)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={send}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-[#1a7f43] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#156b38] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7f43]"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
              Open WhatsApp
            </a>
          </div>
        </div>
      )}

      <button
        ref={toggleRef}
        type="button"
        onClick={() => (open ? close() : openPanel())}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Chat with MEDIUM on WhatsApp"
        title="Chat with MEDIUM on WhatsApp"
        className="fixed right-5 bottom-5 z-40 w-14 h-14 rounded-full bg-[#25D366] hover:bg-[#1faa53] text-white shadow-lg shadow-black/30 flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand cursor-pointer"
      >
        {open ? <X className="w-7 h-7" aria-hidden="true" /> : <WhatsAppIcon />}
      </button>
    </>
  );
};
