import React from 'react';
import { Check } from 'lucide-react';
import { Button, CtaBand, FadeIn, PageHeader, Section } from '../components/ui';
import { SERVICES_DATA } from '../data/websiteData';
import { contactPath, pathFor } from '../routes';

export default function ServicesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Services"
        title="Events, advertising and design for the Maldives market"
        intro="One team for the whole job: from the forum or campaign idea to the stage, the media and the results. Every engagement starts with a conversation about what you need to achieve."
      />

      <Section>
        <div className="divide-y divide-line border-y border-line">
          {SERVICES_DATA.map((service) => (
            <FadeIn key={service.id}>
              <div data-service={service.id} className="grid gap-8 py-12 lg:grid-cols-12">
                <div className="lg:col-span-5">
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">{service.title}</h2>
                  <p className="mt-2 text-base font-medium text-brand">{service.tagline}</p>
                  <p className="mt-4 text-base leading-relaxed text-body">{service.description}</p>
                  <Button variant="secondary" to={contactPath({ service: service.id })} className="mt-6">
                    Request a proposal
                  </Button>
                </div>
                <ul className="lg:col-span-6 lg:col-start-7 grid gap-3 sm:grid-cols-2 content-start">
                  {service.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 rounded-lg border border-line bg-white p-4 text-sm text-ink">
                      <Check className="w-4 h-4 text-brand flex-shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </FadeIn>
          ))}
        </div>
      </Section>

      <CtaBand
        title="Tell us what you're planning."
        text="We'll come back with a proposal, usually within one business day."
        primary={{ label: 'Start an enquiry', to: pathFor('contact') }}
        secondary={{ label: 'View our events', to: pathFor('events') }}
      />
    </>
  );
}
