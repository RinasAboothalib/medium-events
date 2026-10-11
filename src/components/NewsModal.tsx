import React, { useEffect, useRef } from 'react';
import { X, Calendar } from 'lucide-react';
import { NewsArticle } from '../types';
import { Button } from './ui';
import { pathFor } from '../routes';

interface NewsModalProps {
  article: NewsArticle | null;
  onClose: () => void;
}

export const NewsModal: React.FC<NewsModalProps> = ({ article, onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Modal behaviour: focus moves in, Tab stays inside, Escape closes, focus returns, page doesn't scroll
  useEffect(() => {
    if (!article) return;
    const returnFocusTo = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      returnFocusTo?.focus();
    };
  }, [article]);

  if (!article) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="fixed inset-0 bg-ink/60" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="news-modal-title"
        className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl"
      >
        <img src={article.image} alt="" width={960} height={480} className="w-full aspect-[2/1] object-cover" />
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 rounded-md bg-white/90 p-2 text-ink hover:bg-white focus-visible:outline-2 focus-visible:outline-brand cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="p-6 sm:p-8">
          <p className="flex items-center gap-2 text-sm text-muted">
            <Calendar className="w-4 h-4" aria-hidden="true" />
            {article.date} · {article.category}
          </p>
          <h2 id="news-modal-title" className="mt-3 text-2xl font-bold tracking-tight text-ink">
            {article.title}
          </h2>
          <div className="mt-5 space-y-4 text-base leading-relaxed text-body">
            {article.fullContent.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Button to={pathFor('contact')} onClick={onClose}>
              Contact us
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
