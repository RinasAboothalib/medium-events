import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { Activity, Building2, CalendarDays, CircleUser, FileText, Handshake, Inbox, LayoutDashboard, LogOut, Menu, Send, Users, X } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { navFor, type SectionId } from '../lib/permissions';
import { ROLE_LABELS } from '../lib/types';

const ICONS: Record<SectionId, React.FC<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  events: CalendarDays,
  publish: Send,
  enquiries: Inbox,
  sponsors: Building2,
  deals: Handshake,
  reports: FileText,
  staff: Users,
  activity: Activity,
  account: CircleUser,
};

export const Layout: React.FC = () => {
  const { user, role, signOut } = useAuth();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [pathname]);

  const items = navFor(role);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className={`${menuOpen ? 'block' : 'hidden'} lg:block border-r border-line bg-white`}>
        <div className="hidden lg:flex items-center gap-2 px-5 h-16 border-b border-line">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-brand text-sm font-bold text-white">M</span>
          <span className="font-semibold text-ink">MEDIUM Admin</span>
        </div>
        <nav aria-label="Admin" className="p-3 space-y-1">
          {items.map((item) => {
            const Icon = ICONS[item.id];
            return (
              <NavLink
                key={item.id}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand ${
                    isActive ? 'bg-brand-tint text-brand' : 'text-body hover:bg-surface hover:text-ink'
                  }`
                }
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0">
        <header className="flex items-center justify-between gap-4 h-16 border-b border-line bg-white px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className="lg:hidden rounded-md p-2 -ml-2 text-ink hover:bg-surface focus-visible:outline-2 focus-visible:outline-brand cursor-pointer"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <span className="lg:hidden font-semibold text-ink whitespace-nowrap">MEDIUM Admin</span>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden sm:inline font-medium text-ink">{user?.full_name}</span>
            {role && (
              <span className="rounded-md bg-brand-tint px-2 py-0.5 text-xs font-semibold text-brand">{ROLE_LABELS[role]}</span>
            )}
            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 font-semibold text-body hover:text-ink hover:bg-surface focus-visible:outline-2 focus-visible:outline-brand cursor-pointer"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </header>
        <main className="p-4 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
