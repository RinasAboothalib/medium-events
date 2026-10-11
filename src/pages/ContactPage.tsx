import React from 'react';
import { PageHeader } from '../components/ui';
import { EnquiryForm } from '../components/EnquiryForm';

export default function ContactPage() {
  return (
    <>
      <PageHeader
        eyebrow="Contact"
        title="Sponsorship, exhibition and project enquiries"
        intro="Tell us what you're planning and the right person at MEDIUM will get back to you within one business day."
      />
      <EnquiryForm />
    </>
  );
}
