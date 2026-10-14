import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';
import { Button, Card, CtaBand, PageHeader, Section, SectionHeader, StatStrip, PartnerStrip } from '.';

const inRouter = (ui: ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Button', () => {
  it('renders an internal route as a same-tab link', () => {
    inRouter(<Button to="/events">Explore events</Button>);
    const link = screen.getByRole('link', { name: 'Explore events' });
    expect(link.getAttribute('href')).toBe('/events');
    expect(link.getAttribute('target')).toBeNull();
  });

  it('opens external links in a new tab', () => {
    inRouter(
      <Button href="https://cif.mv" external>
        cif.mv
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'cif.mv' });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('styles the primary variant with the brand colour', () => {
    inRouter(<Button to="/contact">Become a sponsor</Button>);
    expect(screen.getByRole('link', { name: 'Become a sponsor' }).className).toContain('bg-brand');
  });

  it('renders a real button when given only onClick', () => {
    inRouter(<Button onClick={() => {}}>Send</Button>);
    expect(screen.getByRole('button', { name: 'Send' })).toBeTruthy();
  });
});

describe('layout primitives', () => {
  it('applies the section tone', () => {
    const { container } = inRouter(<Section tone="brand">x</Section>);
    expect(container.querySelector('section')!.className).toContain('bg-brand');
  });

  it('renders exactly one h1 in the page header', () => {
    inRouter(<PageHeader eyebrow="About" title="Who we are" intro="Intro" />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Who we are');
  });

  it('renders section headers as h2 by default', () => {
    inRouter(<SectionHeader eyebrow="Events" title="Our event series" />);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Our event series');
  });

  it('shows every stat value and label', () => {
    inRouter(<StatStrip stats={[{ value: '9', label: 'events hosted' }, { value: '60+', label: 'years combined experience' }]} />);
    for (const text of ['9', 'events hosted', '60+', 'years combined experience']) expect(screen.getByText(text)).toBeTruthy();
  });

  it('lists partners with their roles', () => {
    inRouter(<PartnerStrip partners={[{ name: 'SITA', role: 'Sponsor, Aviation Forum 2026' }]} />);
    expect(screen.getByText('SITA')).toBeTruthy();
    expect(screen.getByText('Sponsor, Aviation Forum 2026')).toBeTruthy();
  });

  it('links the CTA band actions', () => {
    inRouter(
      <CtaBand
        title="Put your brand in front of the decision makers."
        primary={{ label: 'Become a sponsor', to: '/contact?service=sponsorship' }}
        secondary={{ label: 'View events', to: '/events' }}
      />,
    );
    expect(screen.getByRole('link', { name: 'Become a sponsor' }).getAttribute('href')).toBe('/contact?service=sponsorship');
    expect(screen.getByRole('link', { name: 'View events' }).getAttribute('href')).toBe('/events');
  });

  it('renders a card as a link when given a route', () => {
    inRouter(<Card to="/events/build-expo">Build Expo</Card>);
    expect(screen.getByRole('link', { name: 'Build Expo' }).getAttribute('href')).toBe('/events/build-expo');
  });

  it('gives buttons on blue bands a white focus ring', () => {
    inRouter(
      <>
        <Button variant="inverse" to="/a">On blue</Button>
        <Button variant="inverse-outline" to="/b">Outline on blue</Button>
        <Button to="/c">On white</Button>
      </>,
    );
    for (const name of ['On blue', 'Outline on blue']) {
      const cls = screen.getByRole('link', { name }).className;
      expect(cls).toContain('focus-visible:outline-white');
      expect(cls).not.toContain('focus-visible:outline-brand');
    }
    expect(screen.getByRole('link', { name: 'On white' }).className).toContain('focus-visible:outline-brand');
  });
});
