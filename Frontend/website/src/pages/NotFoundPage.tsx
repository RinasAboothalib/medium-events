import React, { useEffect } from 'react';
import { Button, PageHeader } from '../components/ui';
import { pathFor } from '../routes';

export const NOT_FOUND_TITLE = 'Page not found | MEDIUM Events Maldives';

// Rendered for unknown addresses and pre-rendered to dist/404.html for static hosts
export default function NotFoundPage() {
  useEffect(() => {
    document.title = NOT_FOUND_TITLE;
  }, []);

  return (
    <PageHeader
      eyebrow="404"
      title="Page not found"
      intro="The page you're looking for has moved or doesn't exist. Try one of these instead."
    >
      <div className="flex flex-col sm:flex-row gap-3">
        <Button to={pathFor('home')}>Go to the home page</Button>
        <Button variant="secondary" to={pathFor('events')}>
          View all events
        </Button>
        <Button variant="secondary" to={pathFor('contact')}>
          Contact us
        </Button>
      </div>
    </PageHeader>
  );
}
