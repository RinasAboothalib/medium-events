import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { AlertCircle, CheckCircle2, Clock, Loader2, Mail, MapPin, MessageCircle, Phone, Send } from 'lucide-react';
import { COMPANY_DETAILS, SERVICE_OPTIONS } from '../data/websiteData';
import { EnquirySubmission } from '../types';
import { ADMIN_API_URL, WEB3FORMS_KEY } from '../config';
import { trackEvent } from '../lib/analytics';
import { buildMailtoUrl, buildWhatsAppUrl, enquirySubject, formatEnquiryText, recordEnquiry, submitEnquiry } from '../lib/enquiry';
import { Button, Container } from './ui';

type SendState = 'idle' | 'sending' | 'sent' | 'failed';

const SPONSORSHIP = SERVICE_OPTIONS.find((o) => o.id === 'sponsorship')!.label;
const TIMELINES = ['Within 3 months', 'Within 6 months', 'Within a year', 'Just exploring'];

const EMPTY_FORM: EnquirySubmission = {
  fullName: '',
  company: '',
  email: '',
  phone: '',
  service: SERVICE_OPTIONS.find((o) => o.id === 'general')!.label,
  timeline: TIMELINES[0],
  budget: '',
  message: '',
};

const eventMessage = (event: string) => `I'd like to discuss sponsorship or an exhibition stand at ${event}.`;

const telHref = (phone: string) => `tel:${phone.replace(/[^0-9+]/g, '')}`;

const FIELD =
  'w-full rounded-md border bg-white px-3.5 py-2.5 text-base text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand';

export const EnquiryForm: React.FC = () => {
  const [searchParams] = useSearchParams();
  const prefilledService = searchParams.get('service');
  const prefilledEvent = searchParams.get('event');
  const [formData, setFormData] = useState<EnquirySubmission>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sendState, setSendState] = useState<SendState>('idle');
  const isSubmitting = sendState === 'sending';
  const honeypotRef = useRef<HTMLInputElement>(null);

  // Prefill from /contact?service= or ?event= (applied after mount so it matches the pre-rendered HTML).
  // Runs on every query change, so an event from an earlier link never sticks to a later enquiry.
  useEffect(() => {
    const match = SERVICE_OPTIONS.find((o) => o.id === prefilledService);
    setFormData((prev) => {
      const messageWasPrefilled = Boolean(prev.event) && prev.message === eventMessage(prev.event!);
      const next = { ...prev, event: prefilledEvent ?? undefined };
      if (match) next.service = match.label;
      if (prefilledEvent) {
        next.service = SPONSORSHIP;
        if (!prev.message || messageWasPrefilled) next.message = eventMessage(prefilledEvent);
      } else if (messageWasPrefilled) {
        next.message = '';
      }
      return next;
    });
  }, [prefilledService, prefilledEvent]);

  const update = (field: keyof EnquirySubmission) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.fullName.trim()) newErrors.fullName = 'Enter your full name.';
    if (!formData.email.trim()) newErrors.email = 'Enter your email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Enter a valid email address, like name@company.com.';
    if (!formData.phone.trim()) newErrors.phone = 'Enter a phone or mobile number.';
    if (formData.message.trim().length < 10) newErrors.message = 'Tell us a little about what you need (at least 10 characters).';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Bots tick the hidden honeypot: show them a normal confirmation and send nothing
    if (honeypotRef.current?.checked) {
      setSendState('sent');
      return;
    }

    // Every enquiry also lands in the MEDIUM admin (if configured), whichever way it is sent
    if (ADMIN_API_URL) void recordEnquiry(formData, ADMIN_API_URL);

    // Until MEDIUM's Web3Forms key is configured, enquiries go out over WhatsApp instead
    if (!WEB3FORMS_KEY) {
      trackEvent('whatsapp_click', { location: 'form' });
      window.open(whatsAppUrl, '_blank', 'noopener');
      return;
    }

    setSendState('sending');
    const result = await submitEnquiry(formData, WEB3FORMS_KEY, window.location.href);
    setSendState(result.ok ? 'sent' : 'failed');
    if (result.ok) trackEvent('generate_lead', { service: formData.service, event: formData.event ?? '' });
  };

  const handleReset = () => {
    setFormData(EMPTY_FORM);
    setErrors({});
    setSendState('idle');
  };

  // Pre-filled fallbacks so a lead is never lost when the form can't be delivered
  const enquiryText = formatEnquiryText(formData);
  const whatsAppUrl = buildWhatsAppUrl(COMPANY_DETAILS.whatsapp, enquiryText);
  const mailtoUrl = buildMailtoUrl(COMPANY_DETAILS.inquiryEmail, enquirySubject(formData), enquiryText);
  const requireValid = (e: React.MouseEvent) => {
    if (!validate()) e.preventDefault();
  };

  const fieldError = (field: string) =>
    errors[field] && (
      <p id={`${field}-error`} className="mt-1.5 flex items-center gap-1.5 text-sm text-red-700">
        <AlertCircle className="w-4 h-4" aria-hidden="true" />
        {errors[field]}
      </p>
    );
  const errorProps = (field: string) => ({
    'aria-invalid': Boolean(errors[field]) || undefined,
    'aria-describedby': errors[field] ? `${field}-error` : undefined,
    className: `${FIELD} ${errors[field] ? 'border-red-600' : 'border-line'}`,
  });

  return (
    <section className="bg-white py-16 sm:py-20">
      <Container className="grid gap-12 lg:grid-cols-12">
        {/* Contact details */}
        <aside className="lg:col-span-4 space-y-6">
          <h2 className="text-2xl font-bold tracking-tight text-ink">Talk to us directly</h2>
          <ul className="space-y-5 text-base text-body">
            <li className="flex gap-3">
              <MapPin className="w-5 h-5 text-brand flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span>{COMPANY_DETAILS.address}</span>
            </li>
            <li className="flex gap-3">
              <Phone className="w-5 h-5 text-brand flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                <a href={telHref(COMPANY_DETAILS.phone)} onClick={() => trackEvent('contact_click', { method: 'phone' })} className="font-semibold text-ink hover:text-brand">
                  {COMPANY_DETAILS.phone}
                </a>
                <br />
                <a href={telHref(COMPANY_DETAILS.officePhone)} onClick={() => trackEvent('contact_click', { method: 'phone' })} className="hover:text-brand">
                  {COMPANY_DETAILS.officePhone} (office)
                </a>
              </span>
            </li>
            <li className="flex gap-3">
              <MessageCircle className="w-5 h-5 text-brand flex-shrink-0 mt-0.5" aria-hidden="true" />
              <a
                href={buildWhatsAppUrl(COMPANY_DETAILS.whatsapp, "Hi MEDIUM, I'd like to make an enquiry.")}
                onClick={() => trackEvent('whatsapp_click', { location: 'contact_page' })}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-ink hover:text-brand"
              >
                Chat on WhatsApp ({COMPANY_DETAILS.whatsapp})
              </a>
            </li>
            <li className="flex gap-3">
              <Mail className="w-5 h-5 text-brand flex-shrink-0 mt-0.5" aria-hidden="true" />
              <a href={`mailto:${COMPANY_DETAILS.inquiryEmail}`} onClick={() => trackEvent('contact_click', { method: 'email' })} className="font-semibold text-ink hover:text-brand">
                {COMPANY_DETAILS.inquiryEmail}
              </a>
            </li>
            <li className="flex gap-3">
              <Clock className="w-5 h-5 text-brand flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span>Sunday – Thursday, 09:00 – 17:00 (Maldives time, UTC+5)</span>
            </li>
          </ul>
        </aside>

        {/* Form */}
        <div className="lg:col-span-8">
          <div className="rounded-lg border border-line bg-surface p-6 sm:p-10">
            {sendState === 'sent' ? (
              <div className="py-8 text-center" role="status">
                <CheckCircle2 className="w-12 h-12 text-brand mx-auto" aria-hidden="true" />
                <h2 className="mt-4 text-2xl font-bold text-ink">Enquiry sent</h2>
                <p className="mt-2 text-base text-body">Thanks, {formData.fullName}. MEDIUM will be in touch within 1 business day.</p>
                <Button variant="secondary" onClick={handleReset} className="mt-6">
                  Send another enquiry
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                <div>
                  <h2 className="text-2xl font-bold text-ink">Send an enquiry</h2>
                  <p className="mt-1 text-sm text-body">Fields marked * are required.</p>
                </div>

                {/* Honeypot: hidden from people, bots fill it in and Web3Forms discards the submission */}
                <div aria-hidden="true" className="hidden">
                  <input ref={honeypotRef} type="checkbox" name="botcheck" tabIndex={-1} autoComplete="off" />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="fullName" className="block text-sm font-semibold text-ink mb-1.5">Full name *</label>
                    <input id="fullName" type="text" autoComplete="name" value={formData.fullName} onChange={update('fullName')} disabled={isSubmitting} {...errorProps('fullName')} />
                    {fieldError('fullName')}
                  </div>
                  <div>
                    <label htmlFor="company" className="block text-sm font-semibold text-ink mb-1.5">Organisation</label>
                    <input id="company" type="text" autoComplete="organization" value={formData.company} onChange={update('company')} disabled={isSubmitting} className={`${FIELD} border-line`} />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-ink mb-1.5">Email *</label>
                    <input id="email" type="email" autoComplete="email" placeholder="name@company.com" value={formData.email} onChange={update('email')} disabled={isSubmitting} {...errorProps('email')} />
                    {fieldError('email')}
                  </div>
                  <div>
                    <label htmlFor="phone" className="block text-sm font-semibold text-ink mb-1.5">Phone *</label>
                    <input id="phone" type="tel" autoComplete="tel" placeholder="+960 700 0000" value={formData.phone} onChange={update('phone')} disabled={isSubmitting} {...errorProps('phone')} />
                    {fieldError('phone')}
                  </div>
                  <div>
                    <label htmlFor="service" className="block text-sm font-semibold text-ink mb-1.5">Enquiry type</label>
                    <select id="service" value={formData.service} onChange={update('service')} disabled={isSubmitting} className={`${FIELD} border-line`}>
                      {SERVICE_OPTIONS.map((option) => (
                        <option key={option.id} value={option.label}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="timeline" className="block text-sm font-semibold text-ink mb-1.5">Timeline</label>
                    <select id="timeline" value={formData.timeline} onChange={update('timeline')} disabled={isSubmitting} className={`${FIELD} border-line`}>
                      {TIMELINES.map((timeline) => (
                        <option key={timeline}>{timeline}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-semibold text-ink mb-1.5">Your message *</label>
                  <textarea
                    id="message"
                    rows={5}
                    placeholder="What are you planning? Include the event, dates, audience or campaign goals if you know them."
                    value={formData.message}
                    onChange={update('message')}
                    disabled={isSubmitting}
                    {...errorProps('message')}
                  />
                  {fieldError('message')}
                </div>

                {sendState === 'failed' && (
                  <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 space-y-3">
                    <p className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                      <span>We couldn't send your enquiry just now. Your details are still here, so send them another way:</span>
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <a
                        href={whatsAppUrl}
                        onClick={() => trackEvent('whatsapp_click', { location: 'fallback' })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-md bg-[#1a7f43] px-4 py-2.5 font-semibold text-white hover:bg-[#156b38]"
                      >
                        <MessageCircle className="w-4 h-4" aria-hidden="true" />
                        Send on WhatsApp instead
                      </a>
                      <a href={mailtoUrl} className="inline-flex items-center justify-center gap-2 rounded-md border border-line bg-white px-4 py-2.5 font-semibold text-ink hover:border-brand">
                        <Mail className="w-4 h-4" aria-hidden="true" />
                        Send by email instead
                      </a>
                    </div>
                  </div>
                )}

                <div className="pt-1">
                  <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        Sending enquiry…
                      </>
                    ) : WEB3FORMS_KEY ? (
                      <>
                        <Send className="w-4 h-4" aria-hidden="true" />
                        Send enquiry
                      </>
                    ) : (
                      <>
                        <MessageCircle className="w-4 h-4" aria-hidden="true" />
                        Send via WhatsApp
                      </>
                    )}
                  </Button>
                  {!WEB3FORMS_KEY && (
                    <a href={mailtoUrl} onClick={requireValid} className="mt-3 sm:mt-0 sm:ml-5 inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-brand-hover">
                      <Mail className="w-4 h-4" aria-hidden="true" />
                      Send by email instead
                    </a>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
};
