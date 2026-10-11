import React from 'react';
import { PageHeader } from '../components/ui';
import { NewsSection } from '../components/NewsSection';

export default function NewsPage() {
  return (
    <>
      <PageHeader
        eyebrow="News"
        title="News and announcements"
        intro="Sponsorship signings, forum updates and announcements from MEDIUM Events."
      />
      <NewsSection />
    </>
  );
}
