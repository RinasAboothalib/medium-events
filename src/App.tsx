import React, { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { WhatsAppButton } from './components/WhatsAppButton';
import { legacyHashToPath, routeForPath } from './routes';
import { GA_ID } from './config';
import { initAnalytics, trackPageView } from './lib/analytics';
import { usePageMeta } from './hooks/usePageMeta';

// Site layout shared by every page
export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  usePageMeta();

  // Old single-page links like medium.mv/#events now live at /events
  useEffect(() => {
    if (location.pathname !== '/') return;
    const target = legacyHashToPath(location.hash);
    if (target) navigate(target, { replace: true });
  }, [location.pathname, location.hash, navigate]);

  useEffect(() => {
    initAnalytics(GA_ID);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const route = routeForPath(location.pathname);
    trackPageView(route?.path ?? location.pathname, route?.title ?? document.title);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-white text-body flex flex-col font-sans selection:bg-brand selection:text-white">
      <Navbar />

      <main className="flex-grow">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <Footer />

      <WhatsAppButton />
    </div>
  );
}
