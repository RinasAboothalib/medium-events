import { ServiceItem, NewsArticle, PastEvent, EventSeries } from '../types';
import { PUBLISHED, choosePublished } from './published';

export const COMPANY_DETAILS = {
  name: 'MEDIUM Events Pvt Ltd',
  shortName: 'MEDIUM',
  address: 'Champa Building 4, 5th Floor, Orchid Magu, K. Malé, Maldives',
  altAddress: 'H. Huba (2nd Floor), Medhuziyaaraiy Magu, Malé, Maldives',
  phone: '+960 770-1090',
  secondaryPhone: '+960 799-7974',
  officePhone: '+960 333-0020',
  whatsapp: '+960 799-7974',
  email: 'Operations@medium.mv',
  inquiryEmail: 'info@medium.mv',
  social: {
    facebook: 'https://www.facebook.com/MediumMv/',
    instagram: 'https://www.instagram.com/medium_mv/',
    linkedin: 'https://www.linkedin.com/company/mediummv/',
  },
};

export const SERVICES_DATA: ServiceItem[] = [
  {
    id: 'events',
    title: 'Events',
    tagline: 'Events that leave a lasting impression',
    description:
      'We plan and run conferences, industry forums, exhibitions and product launches from start to finish: venue, programme, speakers, sponsors, stage and production.',
    features: [
      'Conferences, forums and workshops',
      'Exhibitions and trade expos',
      'Product launches and business events',
      'Sponsor and exhibitor management',
      'Stage, audio-visual and production',
      'Project management on the day',
    ],
  },
  {
    id: 'advertising',
    title: 'Advertising and marketing',
    tagline: 'Advertising based on analytics and metrics',
    description:
      'Marketing for niche markets, planned around measurable results and direct revenue. For selected clients we also run long-term marketing plans.',
    features: [
      'Promotional and awareness campaigns',
      'Guerrilla marketing',
      'Long-term marketing plans',
      'Content creation',
      'Campaign measurement and reporting',
    ],
  },
  {
    id: 'design',
    title: 'Design and production',
    tagline: 'Design, video and installation',
    description:
      'Design, video production, installation and application work, from business profiles and publications to video ads and event builds.',
    features: [
      'Video ads',
      'Business profiles',
      'Publishing and print',
      'Concept development',
      'Exhibition and event installations',
    ],
  },
  {
    id: 'consultancy',
    title: 'Creative consultancy',
    tagline: 'A clear route to the right solution',
    description:
      "We treat each client's challenge as a maze to solve: where you are, where you need to be, and the creative route between the two.",
    features: [
      'Concept development',
      'Brand and campaign direction',
      'Market insight for the Maldives',
      'Project planning',
    ],
  },
];

// Events hosted by MEDIUM, as listed on facebook.com/MediumMv (Events → Past)
const BUILT_IN_EVENTS: PastEvent[] = [
  {
    id: 'af-2026',
    name: 'Aviation Forum 2026',
    series: 'Aviation Forum',
    date: 'Tue, 12 May 2026',
    isoDate: '2026-05-12',
    venue: 'JEN Malé Maldives by Shangri-La, Malé',
    description:
      "The Maldives' most influential aviation leaders — government officials and private-sector pioneers — came together to redefine the future of Maldivian aviation. Sponsored by SITA.",
    responded: 16,
    image: '/images/fb/aviation-forum-2026.jpg',
    facebookUrl: 'https://www.facebook.com/events/1592477385417941/',
  },
  {
    id: 'cif-2025',
    name: 'Construction Industry Forum 2025',
    series: 'Construction Industry Forum',
    date: 'Tue, 2 Sep 2025',
    isoDate: '2025-09-02',
    venue: 'JEN Malé Maldives by Shangri-La, Malé',
    description:
      'High-level decision makers of the building and construction industry from government and private sectors exchanged perspectives to shape the industry moving forward.',
    responded: 200,
    image: '/images/fb/cif-2025.jpg',
    facebookUrl: 'https://www.facebook.com/events/589833897305904/',
  },
  {
    id: 'mmif-2025',
    name: 'Maldives Marine Industry Forum 2025',
    series: 'Marine Industry Forum',
    date: 'Tue, 1 Jul 2025',
    isoDate: '2025-07-01',
    venue: 'JEN Malé Maldives by Shangri-La, Malé',
    description:
      'Marine industry leaders, decision makers and key stakeholders identified the fundamental issues facing the marine industry, presented solutions and raised awareness.',
    responded: 17,
    image: '/images/fb/mmif-2025.jpg',
    facebookUrl: 'https://www.facebook.com/events/1143988937284984/',
  },
  {
    id: 'build-expo-2025',
    name: 'Build Expo 2025',
    series: 'Build Expo',
    date: '24 – 27 Apr 2025',
    isoDate: '2025-04-24',
    venue: "Hulhumalé Central Park, Hulhumalé",
    description:
      'The official exhibition of MNACI — four days of exhibition and equipment displays, stage activities, networking sessions, product launches and entertainment.',
    responded: 195,
    image: '/images/fb/build-expo-2025.jpg',
    facebookUrl: 'https://www.facebook.com/events/402937255637143/',
  },
  {
    id: 'cif-2024',
    name: 'Construction Industry Forum 2024',
    series: 'Construction Industry Forum',
    date: 'Mon, 19 Aug 2024',
    isoDate: '2024-08-19',
    venue: 'Manhattan Business Hotel, Malé',
    description:
      'The second annual gathering of the construction industry’s decision makers, presenting solutions to the crucial issues facing the Maldives building sector.',
    responded: 65,
    image: '/images/fb/cif-2024.jpg',
    facebookUrl: 'https://www.facebook.com/events/1938179463291667/',
  },
  {
    id: 'mmif-2024',
    name: 'Maldives Marine Industry Forum 2024',
    series: 'Marine Industry Forum',
    date: 'Sat, 6 Jul 2024',
    isoDate: '2024-07-06',
    venue: 'JEN Malé Maldives by Shangri-La, Malé',
    description:
      'The second edition of MMIF brought government and private-sector marine leaders together to direct the future of the Maldives marine industry.',
    responded: 44,
    image: '/images/fb/mmif-2024.jpg',
    facebookUrl: 'https://www.facebook.com/events/784538483536193/',
  },
  {
    id: 'af-2024',
    name: 'Aviation Forum 2024',
    series: 'Aviation Forum',
    date: 'Sat, 27 Apr 2024',
    isoDate: '2024-04-27',
    venue: 'JEN Malé Maldives by Shangri-La, Malé',
    description:
      'The inaugural Aviation Forum gathered key stakeholders of the aviation industry from government and private sectors to present solutions and direct the future of Maldivian aviation.',
    responded: 223,
    image: '/images/fb/aviation-forum-2024.jpg',
    facebookUrl: 'https://www.facebook.com/events/3233118503650348/',
  },
  {
    id: 'cif-2023',
    name: 'Construction Industry Forum 2023',
    series: 'Construction Industry Forum',
    date: 'Sat, 12 Aug 2023',
    isoDate: '2023-08-12',
    venue: 'Meerumaa Hall, Malé',
    description:
      'The first Construction Industry Forum — a high-level dialogue and business networking platform for the construction industry of the Maldives.',
    responded: 18,
    image: '/images/fb/cif-2023.jpg',
    facebookUrl: 'https://www.facebook.com/events/665198652342686/',
  },
  {
    id: 'mmif-2023',
    name: 'Maldives Marine Industry Forum 2023',
    series: 'Marine Industry Forum',
    date: 'Sat, 27 May 2023',
    isoDate: '2023-05-27',
    venue: 'JEN Malé Maldives by Shangri-La, Malé',
    description:
      'The first Maldives Marine Industry Forum, an annual gathering of high-level decision makers of the marine industry from government and private sectors.',
    responded: 99,
    image: '/images/fb/mmif-2023.jpg',
    facebookUrl: 'https://www.facebook.com/events/1290445591543095/',
  },
];

export const NEWS_ARTICLES_DATA: NewsArticle[] = [
  {
    id: 'ooredoo-cif-2026-platinum',
    title: 'Ooredoo Maldives Signs On as Exclusive Platinum Sponsor of CIF 2026',
    category: 'Press Releases',
    date: '6 July 2026',
    readTime: '2 min read',
    summary:
      'Ooredoo Maldives has officially signed on as Exclusive Platinum Sponsor for the Construction Industry Forum – CIF 2026, held on 18 August 2026 at Grand Parkside, One Central Park, Hulhumalé.',
    fullContent: [
      'We are proud to announce that Ooredoo Maldives has officially signed on as Exclusive Platinum Sponsor for the Construction Industry Forum – CIF 2026, scheduled to be held on 18 August 2026 at Grand Parkside, One Central Park, Hulhumalé.',
      'Construction Industry Forum is a high-level dialogue and business networking platform for the construction industry of the Maldives.',
      'The official signing took place between Mr. Rajesh Mehta, Chief Business Officer of Ooredoo Maldives, and Mr. Sham Mohamed, Director of Medium Events Pvt Ltd.',
      'CIF 2026 is proudly endorsed by the Maldives National Association of Construction Industry (www.mnaci.org) and organized by Medium Events Pvt Ltd.',
    ],
    tags: ['CIF 2026', 'Ooredoo Maldives', 'MNACI', 'Sponsorship'],
    image: '/images/fb/ooredoo-cif-2026-signing.jpg',
  },
  {
    id: 'aviation-forum-2026',
    title: 'Aviation Forum 2026 Convenes Maldivian Aviation Leaders at Hotel JEN Malé',
    category: 'Expos & Forums',
    date: '12 May 2026',
    readTime: '2 min read',
    summary:
      'The second Aviation Forum – Connecting Maldives, sponsored by SITA, united government officials and private-sector pioneers to reshape the aviation industry through stakeholder dialogue.',
    fullContent: [
      "Aviation Forum 2026 brought together the Maldives' most influential aviation leaders on 12 May 2026 at Hotel JEN Malé Maldives by Shangri-La.",
      'This premier summit unites high-level government officials and private-sector pioneers to collaborate, innovate and redefine the future of the industry — generating actionable solutions and directing the strategic trajectory of Maldivian aviation.',
      'The 2026 edition was sponsored by SITA. Aviation Forum is organized by Medium Events Pvt Ltd — for more information visit www.aviationforum.mv, call +960 770-1090 or email info@medium.mv.',
    ],
    tags: ['Aviation Forum', 'SITA', 'JEN Malé', 'Connecting Maldives'],
    image: '/images/fb/aviation-forum-2026.jpg',
  },
];


// Event series MEDIUM organises. Facts from the series' Facebook events, posts and banners.
const BUILT_IN_SERIES: EventSeries[] = [
  {
    slug: 'construction-industry-forum',
    name: 'Construction Industry Forum',
    shortName: 'CIF',
    series: 'Construction Industry Forum',
    tagline: 'High-level dialogue and business networking for the Maldives construction industry.',
    description: [
      'The Construction Industry Forum is an annual gathering of decision makers from the government and private sectors of the building and construction industry.',
      'Industry leaders and key stakeholders identify the fundamental issues facing the industry, present solutions and raise awareness, to shape where Maldivian construction goes next.',
    ],
    website: 'https://cif.mv',
    endorsement: 'Endorsed by MNACI',
    audience: 'Government and private-sector decision makers in building and construction',
    usualVenue: 'Malé and Hulhumalé',
    usualMonth: 'August–September',
    partners: [
      { name: 'MNACI', role: 'Endorsing association' },
      { name: 'Ooredoo Maldives', role: 'Exclusive Platinum Sponsor, CIF 2026' },
    ],
  },
  {
    slug: 'marine-industry-forum',
    name: 'Maldives Marine Industry Forum',
    shortName: 'MMIF',
    series: 'Marine Industry Forum',
    tagline: 'Where the Maldives marine industry meets to plan its future.',
    description: [
      'The Maldives Marine Industry Forum is an annual gathering of decision makers from the government and private sectors of the marine industry.',
      'Industry leaders and key stakeholders identify the fundamental issues facing the marine industry, present solutions and raise awareness.',
    ],
    website: 'https://mmif.mv',
    audience: 'Marine industry leaders from government and the private sector',
    usualVenue: 'JEN Malé Maldives by Shangri-La',
    usualMonth: 'May–July',
    partners: [],
  },
  {
    slug: 'aviation-forum',
    name: 'Aviation Forum – Connecting Maldives',
    shortName: 'Aviation Forum',
    series: 'Aviation Forum',
    tagline: 'Reshaping the aviation industry of the Maldives through stakeholder dialogue.',
    description: [
      "The Aviation Forum brings together the Maldives' most influential aviation leaders, uniting senior government officials and private-sector pioneers.",
      'Its purpose is practical: to agree actionable solutions and set the strategic direction of Maldivian aviation.',
    ],
    website: 'https://aviationforum.mv',
    audience: 'Government officials and private-sector aviation leaders',
    usualVenue: 'JEN Malé Maldives by Shangri-La',
    usualMonth: 'April–May',
    partners: [{ name: 'SITA', role: 'Sponsor, Aviation Forum 2026' }],
  },
  {
    slug: 'build-expo',
    name: 'Build Expo',
    shortName: 'Build Expo',
    series: 'Build Expo',
    tagline: 'The official exhibition of the Maldives National Association of Construction Industry.',
    description: [
      'Build Expo is a four-day exhibition at Central Park, Hulhumalé, with an exhibition and equipment display area, stage activities, networking sessions, product launches and entertainment.',
      'It is a place to meet prospective customers and gain recognition across the construction industry.',
    ],
    endorsement: 'Official exhibition of MNACI',
    audience: 'Contractors, suppliers, developers and the public',
    usualVenue: 'Central Park, Hulhumalé',
    usualMonth: 'April',
    partners: [{ name: 'MNACI', role: 'Official exhibition partner' }],
    ctaSecondary: 'Book a stand',
  },
];

export function editionsFor(series: PastEvent['series']): PastEvent[] {
  return PAST_EVENTS_DATA.filter((e) => e.series === series).sort((a, b) => b.isoDate.localeCompare(a.isoDate));
}

export function seriesBySlug(slug: string): EventSeries | undefined {
  return EVENT_SERIES.find((s) => s.slug === slug);
}

const BUILT_IN_PARTNERS = [
  { name: 'MNACI', role: 'Endorsing association, CIF and Build Expo' },
  { name: 'Ooredoo Maldives', role: 'Exclusive Platinum Sponsor, CIF 2026' },
  { name: 'SITA', role: 'Sponsor, Aviation Forum 2026' },
];

// Events published from the MEDIUM admin replace the built-in lists above (src/data/published.ts)
const EVENT_DATA = choosePublished(PUBLISHED, { series: BUILT_IN_SERIES, events: BUILT_IN_EVENTS, partners: BUILT_IN_PARTNERS });
export const EVENT_SERIES: EventSeries[] = EVENT_DATA.series;
export const PAST_EVENTS_DATA: PastEvent[] = EVENT_DATA.events;
export const VERIFIED_PARTNERS = EVENT_DATA.partners;

const firstEventYear = PAST_EVENTS_DATA.map((e) => e.isoDate.slice(0, 4)).sort()[0];

export const SITE_STATS = [
  { value: String(PAST_EVENTS_DATA.length), label: 'events hosted' },
  { value: String(EVENT_SERIES.length), label: 'event series' },
  ...(firstEventYear ? [{ value: firstEventYear, label: 'first forum' }] : []),
  { value: '60+', label: 'years combined experience' },
];

// Enquiry types offered by the contact form; ids are used in /contact?service=<id>
export const SERVICE_OPTIONS = [
  { id: 'sponsorship', label: 'Sponsorship or exhibition stand' },
  ...SERVICES_DATA.map((service) => ({ id: service.id, label: service.title })),
  { id: 'general', label: 'General enquiry' },
];
