import React from 'react';
import { Link } from 'react-router';

export default function NotFoundPage() {
  return (
    <section>
      <h1 className="text-2xl font-bold text-ink">Page not found</h1>
      <p className="mt-2 text-body">
        This page doesn't exist.{' '}
        <Link to="/" className="font-semibold text-brand hover:text-brand-hover">
          Go to the dashboard
        </Link>
        .
      </p>
    </section>
  );
}
