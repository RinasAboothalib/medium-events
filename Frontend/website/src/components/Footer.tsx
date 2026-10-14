import React from 'react';
import { Link } from 'react-router';
import { Facebook, Instagram, Linkedin } from 'lucide-react';
import { Logo } from './Logo';
import { Container } from './ui';
import { COMPANY_DETAILS, EVENT_SERIES } from '../data/websiteData';
import { MAIN_ROUTES, seriesPath } from '../routes';
import { buildWhatsAppUrl } from '../lib/enquiry';
import { trackEvent } from '../lib/analytics';
import { ADMIN_URL } from '../config';

const telHref = (phone: string) => `tel:${phone.replace(/[^0-9+]/g, '')}`;

const FOOTER_LINK = 'text-on-brand-muted hover:text-white transition-colors focus-visible:outline-2 focus-visible:outline-white rounded-sm';

const SOCIAL = [
  { href: COMPANY_DETAILS.social.facebook, label: 'MEDIUM Events on Facebook', Icon: Facebook },
  { href: COMPANY_DETAILS.social.instagram, label: 'MEDIUM Events on Instagram', Icon: Instagram },
  { href: COMPANY_DETAILS.social.linkedin, label: 'MEDIUM Events on LinkedIn', Icon: Linkedin },
];

export const Footer: React.FC = () => (
  <footer className="bg-footer text-on-brand-muted">
    <Container className="py-16 grid gap-12 md:grid-cols-2 lg:grid-cols-12">
      <div className="lg:col-span-4 space-y-5">
        <Link to="/" aria-label="MEDIUM Events home" className="inline-block rounded-md focus-visible:outline-2 focus-visible:outline-white">
          <Logo variant="full" />
        </Link>
        <p className="text-sm leading-relaxed max-w-sm">
          MEDIUM Events organises national industry forums and exhibitions in the Maldives, and delivers advertising, design
          and creative consultancy.
        </p>
        <div className="flex gap-3">
          {SOCIAL.map(({ href, label, Icon }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className="w-9 h-9 rounded-md border border-white/20 flex items-center justify-center text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
            >
              <Icon className="w-4 h-4" />
            </a>
          ))}
        </div>
      </div>

      <div className="lg:col-span-2">
        <h2 className="text-sm font-semibold text-white mb-4">Company</h2>
        <ul className="space-y-2.5 text-sm">
          {MAIN_ROUTES.map((route) => (
            <li key={route.id}>
              <Link to={route.path} className={FOOTER_LINK}>
                {route.navLabel}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="lg:col-span-3">
        <h2 className="text-sm font-semibold text-white mb-4">Event series</h2>
        <ul className="space-y-2.5 text-sm">
          {EVENT_SERIES.map((series) => (
            <li key={series.slug}>
              <Link to={seriesPath(series.slug)} className={FOOTER_LINK}>
                {series.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="lg:col-span-3">
        <h2 className="text-sm font-semibold text-white mb-4">Contact</h2>
        <address className="not-italic space-y-2.5 text-sm">
          <p>{COMPANY_DETAILS.address}</p>
          <p>
            <a href={telHref(COMPANY_DETAILS.phone)} onClick={() => trackEvent('contact_click', { method: 'phone' })} className={FOOTER_LINK}>
              {COMPANY_DETAILS.phone}
            </a>
            {' · '}
            <a href={telHref(COMPANY_DETAILS.officePhone)} onClick={() => trackEvent('contact_click', { method: 'phone' })} className={FOOTER_LINK}>
              {COMPANY_DETAILS.officePhone} (office)
            </a>
          </p>
          <p>
            <a
              href={buildWhatsAppUrl(COMPANY_DETAILS.whatsapp, "Hi MEDIUM, I'd like to make an enquiry.")}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent('whatsapp_click', { location: 'footer' })}
              className={FOOTER_LINK}
            >
              WhatsApp {COMPANY_DETAILS.whatsapp}
            </a>
          </p>
          <p>
            <a href={`mailto:${COMPANY_DETAILS.inquiryEmail}`} onClick={() => trackEvent('contact_click', { method: 'email' })} className={FOOTER_LINK}>
              {COMPANY_DETAILS.inquiryEmail}
            </a>
          </p>
        </address>
      </div>
    </Container>

    <div className="border-t border-white/10">
      <Container className="py-6 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <span>© {new Date().getFullYear()} MEDIUM Events Pvt Ltd · Malé, Maldives</span>
        <a href={`${ADMIN_URL}/login`} rel="nofollow" className={FOOTER_LINK}>
          Staff login
        </a>
      </Container>
    </div>
  </footer>
);
