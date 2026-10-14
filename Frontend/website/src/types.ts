export interface ServiceItem {
  id: string;
  title: string;
  tagline: string;
  description: string;
  features: string[];
}

export interface PastEvent {
  id: string;
  name: string;
  // The series' card label, e.g. 'Aviation Forum' (EventSeries.series)
  series: string;
  date: string;
  isoDate: string;
  venue: string;
  description: string;
  responded: number;
  image: string;
  facebookUrl: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  category: 'Expos & Forums' | 'Company News' | 'Press Releases';
  date: string;
  readTime: string;
  summary: string;
  fullContent: string[];
  tags: string[];
  image: string;
}

export interface EnquirySubmission {
  fullName: string;
  company: string;
  email: string;
  phone: string;
  service: string;
  timeline: string;
  budget?: string;
  message: string;
  event?: string;
}

export interface EventSeries {
  slug: string;
  name: string;
  shortName: string;
  series: PastEvent['series'];
  tagline: string;
  description: string[];
  website?: string;
  endorsement?: string;
  audience: string;
  usualVenue: string;
  usualMonth: string;
  partners: { name: string; role: string }[];
  ctaSecondary?: string;
}
