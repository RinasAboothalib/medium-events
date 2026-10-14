import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EditionCard } from './EditionCard';
import type { PastEvent } from '../types';

const event: PastEvent = {
  id: 'e1',
  name: 'Tourism Forum 2026',
  series: 'Tourism Forum',
  date: 'Tue, 12 May 2026',
  isoDate: '2026-05-12',
  venue: 'JEN Malé',
  description: 'Leaders met.',
  responded: 40,
  image: '/images/cms/e1.jpg',
  facebookUrl: 'https://www.facebook.com/events/1/',
};

describe('EditionCard', () => {
  it('shows the banner, responses and Facebook link', () => {
    render(<EditionCard event={event} />);
    expect(screen.getByRole('img', { name: 'Tourism Forum 2026 banner' })).toBeTruthy();
    expect(screen.getByText('40 responded on Facebook')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View on Facebook' }).getAttribute('href')).toBe('https://www.facebook.com/events/1/');
  });

  it('leaves out what an edition published from the admin may not have', () => {
    render(<EditionCard event={{ ...event, image: '', facebookUrl: '', responded: 0 }} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByText(/responded on Facebook/)).toBeNull();
    expect(screen.queryByRole('link', { name: 'View on Facebook' })).toBeNull();
  });
});
