import React from 'react';

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  intro?: string;
  align?: 'left' | 'center';
  as?: 'h1' | 'h2';
  onBrand?: boolean;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  eyebrow,
  title,
  intro,
  align = 'left',
  as: Heading = 'h2',
  onBrand = false,
}) => (
  <div className={`max-w-2xl mb-10 ${align === 'center' ? 'mx-auto text-center' : ''}`}>
    {eyebrow && (
      <p className={`text-xs font-semibold uppercase tracking-[0.14em] mb-3 ${onBrand ? 'text-on-brand-muted' : 'text-brand'}`}>
        {eyebrow}
      </p>
    )}
    <Heading
      className={`font-bold tracking-tight ${onBrand ? 'text-white' : 'text-ink'} ${
        Heading === 'h1' ? 'text-4xl sm:text-5xl leading-[1.1]' : 'text-3xl sm:text-4xl leading-tight'
      }`}
    >
      {title}
    </Heading>
    {intro && <p className={`mt-4 text-lg leading-relaxed ${onBrand ? 'text-on-brand-muted' : 'text-body'}`}>{intro}</p>}
  </div>
);
