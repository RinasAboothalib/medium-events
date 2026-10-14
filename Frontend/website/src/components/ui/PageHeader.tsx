import React from 'react';
import { Container } from './Container';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  intro?: string;
  children?: React.ReactNode;
}

// Top of every inner page; holds the page's only h1
export const PageHeader: React.FC<PageHeaderProps> = ({ eyebrow, title, intro, children }) => (
  <header className="bg-surface border-b border-line pt-32 pb-14 sm:pb-16">
    <Container>
      <div className="max-w-3xl">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand mb-3">{eyebrow}</p>}
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-ink leading-[1.1]">{title}</h1>
        {intro && <p className="mt-5 text-lg sm:text-xl leading-relaxed text-body">{intro}</p>}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </Container>
  </header>
);
