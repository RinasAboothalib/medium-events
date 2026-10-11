import React from 'react';
import { Section } from './Section';
import { Button } from './Button';

interface CtaBandProps {
  title: string;
  text?: string;
  primary: { label: string; to: string };
  secondary?: { label: string; to: string };
}

export const CtaBand: React.FC<CtaBandProps> = ({ title, text, primary, secondary }) => (
  <Section tone="brand">
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
      <div className="max-w-2xl">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">{title}</h2>
        {text && <p className="mt-3 text-lg text-on-brand-muted">{text}</p>}
      </div>
      <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
        <Button variant="inverse" to={primary.to}>
          {primary.label}
        </Button>
        {secondary && (
          <Button variant="inverse-outline" to={secondary.to}>
            {secondary.label}
          </Button>
        )}
      </div>
    </div>
  </Section>
);
