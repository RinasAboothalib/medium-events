import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Menu, X } from 'lucide-react';
import { Logo } from './Logo';
import { Button, Container } from './ui';
import { MAIN_ROUTES, contactPath, routeForPath } from '../routes';

const SPONSOR_PATH = contactPath({ service: 'sponsorship' });

export const Navbar: React.FC = () => {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const route = routeForPath(pathname);
  // Series pages live under Events in the navigation; unknown addresses mark nothing
  const activeId = route?.kind === 'series' ? 'events' : route?.id;

  useEffect(() => setMenuOpen(false), [pathname]);
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="fixed top-0 inset-x-0 z-40 bg-white border-b border-line">
      <Container className="flex h-18 items-center justify-between gap-6">
        <Link
          to="/"
          onClick={closeMenu}
          aria-label="MEDIUM Events home"
          className="flex items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
        >
          <Logo variant="full" light={false} />
        </Link>

        <nav aria-label="Main" className="hidden lg:flex items-center gap-1">
          {MAIN_ROUTES.map((item) => {
            const isActive = activeId === item.id;
            return (
              <Link
                key={item.id}
                to={item.path}
                aria-current={isActive ? 'page' : undefined}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-brand ${
                  isActive ? 'text-brand' : 'text-body hover:text-ink'
                }`}
              >
                {item.navLabel}
              </Link>
            );
          })}
        </nav>

        <div className="hidden lg:block">
          <Button to={SPONSOR_PATH} className="py-2.5">
            Become a sponsor
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          className="lg:hidden p-2 -mr-2 rounded-md text-ink hover:bg-surface focus-visible:outline-2 focus-visible:outline-brand cursor-pointer"
        >
          {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </Container>

      {menuOpen && (
        <nav id="mobile-menu" aria-label="Mobile" className="lg:hidden border-t border-line bg-white">
          <Container className="py-4 flex flex-col gap-1">
            {MAIN_ROUTES.map((item) => (
              <Link
                key={item.id}
                to={item.path}
                onClick={closeMenu}
                aria-current={activeId === item.id ? 'page' : undefined}
                className={`px-3 py-3 rounded-md text-base font-medium ${
                  activeId === item.id ? 'bg-brand-tint text-brand' : 'text-ink hover:bg-surface'
                }`}
              >
                {item.navLabel}
              </Link>
            ))}
            <Button to={SPONSOR_PATH} onClick={closeMenu} className="mt-3 w-full">
              Become a sponsor
            </Button>
          </Container>
        </nav>
      )}
    </header>
  );
};
