import React from 'react';
import { Link } from 'react-router';

// Shared building blocks for admin pages, matching the Staff page's look.

export const FIELD =
  'w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand disabled:bg-surface disabled:text-muted';
export const PRIMARY =
  'inline-flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60 cursor-pointer';
export const SECONDARY =
  'inline-flex items-center justify-center gap-2 rounded-md border border-line bg-white px-3 py-1.5 text-sm font-semibold text-ink hover:border-brand focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';
export const DANGER =
  'inline-flex items-center justify-center rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600 disabled:opacity-50 cursor-pointer';
export const LINK = 'font-semibold text-brand hover:text-brand-hover';
export const TABLE_WRAP = 'mt-6 overflow-x-auto rounded-lg border border-line bg-white';
export const TH = 'px-4 py-3';
export const TD = 'px-4 py-3';

export function PageHeader({ title, intro, back, children }: { title: string; intro?: string; back?: { to: string; label: string }; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div className="min-w-0">
        {back && (
          <Link to={back.to} className={`text-sm ${LINK}`}>
            ← {back.label}
          </Link>
        )}
        <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-ink break-words">{title}</h1>
        {intro && <p className="mt-1 text-body">{intro}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2 shrink-0">{children}</div>}
    </div>
  );
}

export type Message = { kind: 'error' | 'success'; text: string } | null;

export function Notice({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <p
      role={message.kind === 'error' ? 'alert' : 'status'}
      className={`mt-6 rounded-md border px-4 py-3 text-sm ${
        message.kind === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-800'
      }`}
    >
      {message.text}
    </p>
  );
}

// Label + control + optional hint and field error, with ids wired for screen readers
export function Field({
  id,
  label,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>;
}) {
  const described = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-semibold text-ink mb-1.5">
        {label}
      </label>
      {React.cloneElement(children, { id, 'aria-describedby': described, 'aria-invalid': error ? true : undefined })}
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

// Inline "are you sure?" panel for deletes and other irreversible actions
export function Confirm({ title, detail, confirmLabel, onConfirm, onCancel }: { title: string; detail?: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div role="alertdialog" aria-labelledby="confirm-title" className="mt-6 rounded-lg border border-line bg-white p-5">
      <p id="confirm-title" className="font-semibold text-ink">
        {title}
      </p>
      {detail && <p className="mt-1 text-sm text-body">{detail}</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" className={PRIMARY} onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button type="button" className={SECONDARY} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function Loading() {
  return <p className="mt-6 text-sm text-muted">Loading…</p>;
}
