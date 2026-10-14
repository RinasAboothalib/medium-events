import React from 'react';
import { Link } from 'react-router';

const CARD =
  'block h-full rounded-lg border border-line bg-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

interface CardProps {
  to?: string;
  href?: string;
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ to, href, children, className = '' }) => {
  if (to) {
    return (
      <Link to={to} className={`${CARD} hover:border-brand ${className}`}>
        {children}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={`${CARD} hover:border-brand ${className}`}>
        {children}
      </a>
    );
  }
  return <div className={`${CARD} ${className}`}>{children}</div>;
};
