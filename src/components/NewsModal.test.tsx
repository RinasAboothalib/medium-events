import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { NewsSection } from './NewsSection';

vi.mock('../lib/analytics', () => ({ initAnalytics: vi.fn(), trackPageView: vi.fn(), trackEvent: vi.fn() }));

function openFirstStory() {
  render(
    <MemoryRouter>
      <NewsSection />
    </MemoryRouter>,
  );
  const trigger = screen.getAllByRole('button', { name: /Read the full story/ })[0];
  trigger.focus();
  fireEvent.click(trigger);
  return { trigger, dialog: screen.getByRole('dialog') };
}

describe('NewsModal', () => {
  it('moves focus into the dialog and locks page scroll', () => {
    const { dialog } = openFirstStory();
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('keeps Tab inside the dialog', () => {
    const { dialog } = openFirstStory();
    const focusable = dialog.querySelectorAll<HTMLElement>('a[href], button');
    const last = focusable[focusable.length - 1];
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(focusable[0]);
    focusable[0].focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('closes on Escape and returns focus to the story button', () => {
    const { trigger } = openFirstStory();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe('');
  });
});
