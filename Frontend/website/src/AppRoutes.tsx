import React from 'react';
import { Route, Routes, useParams } from 'react-router';
import App from './App';
import HomePage from './pages/HomePage';
import ServicesPage from './pages/ServicesPage';
import EventsPage from './pages/EventsPage';
import SeriesPage from './pages/SeriesPage';
import AboutPage from './pages/AboutPage';
import NewsPage from './pages/NewsPage';
import ContactPage from './pages/ContactPage';
import NotFoundPage from './pages/NotFoundPage';
import { seriesBySlug } from './data/websiteData';
import { pathFor } from './routes';

// Unknown series slugs get the not-found page
function SeriesRoute() {
  const series = seriesBySlug(useParams().slug ?? '');
  return series ? <SeriesPage key={series.slug} series={series} /> : <NotFoundPage />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<App />}>
        <Route index element={<HomePage />} />
        <Route path={pathFor('services')} element={<ServicesPage />} />
        <Route path={pathFor('events')} element={<EventsPage />} />
        <Route path={`${pathFor('events')}/:slug`} element={<SeriesRoute />} />
        <Route path={pathFor('about')} element={<AboutPage />} />
        <Route path={pathFor('news')} element={<NewsPage />} />
        <Route path={pathFor('contact')} element={<ContactPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
