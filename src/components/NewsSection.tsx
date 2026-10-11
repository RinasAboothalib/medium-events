import React, { useState } from 'react';
import { Calendar, ArrowRight } from 'lucide-react';
import { NEWS_ARTICLES_DATA } from '../data/websiteData';
import { NewsArticle } from '../types';
import { FadeIn, Section } from './ui';
import { NewsModal } from './NewsModal';

export const NewsSection: React.FC = () => {
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);

  return (
    <Section>
      <div className="grid gap-6 md:grid-cols-2">
        {NEWS_ARTICLES_DATA.map((article, idx) => (
          <FadeIn key={article.id} delay={idx * 0.05}>
            <article className="h-full flex flex-col rounded-lg border border-line bg-white overflow-hidden">
              <div className="aspect-[2/1] bg-surface overflow-hidden">
                <img src={article.image} alt="" width={960} height={480} loading="lazy" className="w-full h-full object-cover" />
              </div>
              <div className="p-6 flex flex-col flex-grow">
                <p className="flex items-center gap-2 text-sm text-muted">
                  <Calendar className="w-4 h-4" aria-hidden="true" />
                  {article.date} · {article.category}
                </p>
                <h2 className="mt-3 text-xl font-semibold text-ink">{article.title}</h2>
                <p className="mt-3 text-base leading-relaxed text-body">{article.summary}</p>
                <button
                  type="button"
                  onClick={() => setSelectedArticle(article)}
                  className="mt-auto pt-5 self-start inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-hover focus-visible:outline-2 focus-visible:outline-brand rounded-sm cursor-pointer"
                >
                  Read the full story
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </article>
          </FadeIn>
        ))}
      </div>

      <NewsModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />
    </Section>
  );
};
