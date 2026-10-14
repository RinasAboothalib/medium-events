import React from 'react';
import { Link } from 'react-router';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 cursor-pointer';

const VARIANTS = {
  primary: 'bg-brand text-white hover:bg-brand-hover focus-visible:outline-brand',
  secondary: 'border border-brand text-brand bg-white hover:bg-brand-tint focus-visible:outline-brand',
  // For use on brand-blue backgrounds
  inverse: 'bg-white text-brand hover:bg-brand-tint focus-visible:outline-white',
  'inverse-outline': 'border border-white/70 text-white hover:bg-white/10 focus-visible:outline-white',
} as const;

interface ButtonProps {
  variant?: keyof typeof VARIANTS;
  to?: string;
  href?: string;
  external?: boolean;
  onClick?: React.MouseEventHandler;
  type?: 'button' | 'submit';
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  to,
  href,
  external = false,
  onClick,
  type = 'button',
  disabled,
  children,
  className = '',
}) => {
  const classes = `${BASE} ${VARIANTS[variant]} ${className}`;
  if (to) {
    return (
      <Link to={to} onClick={onClick} className={classes}>
        {children}
      </Link>
    );
  }
  if (href) {
    return (
      <a
        href={href}
        onClick={onClick}
        className={classes}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {children}
      </a>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${classes} disabled:opacity-60`}>
      {children}
    </button>
  );
};
