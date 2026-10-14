import React from 'react';
import { Container } from './Container';

const TONES = {
  white: 'bg-white text-body',
  surface: 'bg-surface text-body',
  brand: 'bg-brand text-on-brand-muted',
} as const;

interface SectionProps {
  tone?: keyof typeof TONES;
  id?: string;
  children: React.ReactNode;
  className?: string;
}

export const Section: React.FC<SectionProps> = ({ tone = 'white', id, children, className = '' }) => (
  <section id={id} className={`py-16 sm:py-20 ${TONES[tone]} ${className}`}>
    <Container>{children}</Container>
  </section>
);
