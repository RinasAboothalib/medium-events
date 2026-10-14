import React from 'react';
import { NavLink } from 'react-router';
import { useAuth } from '../lib/auth';
import { getEdition } from '../lib/events';
import { can, type Permission } from '../lib/permissions';
import { useLoad } from '../lib/useLoad';
import type { Edition } from '../lib/types';
import { Loading, PageHeader } from './ui';

// The parts of an edition; each tab shows only to roles the server lets read it
export const EDITION_TABS: { path: string; label: string; permission: Permission }[] = [
  { path: '', label: 'Details', permission: 'events.read' },
  { path: '/programme', label: 'Programme', permission: 'events.read' },
  { path: '/delegates', label: 'Delegates', permission: 'delegates.read' },
  { path: '/tasks', label: 'Tasks', permission: 'tasks.read' },
  { path: '/budget', label: 'Budget', permission: 'expenses.read' },
];

export function EditionTabs({ editionId }: { editionId: string }) {
  const { role } = useAuth();
  return (
    <nav aria-label="Edition" className="mt-6 flex flex-wrap gap-1 border-b border-line">
      {EDITION_TABS.filter((tab) => can(role, tab.permission)).map((tab) => (
        <NavLink
          key={tab.path}
          to={`/events/editions/${editionId}${tab.path}`}
          end
          className={({ isActive }) =>
            `-mb-px border-b-2 px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-brand ${
              isActive ? 'border-brand text-brand' : 'border-transparent text-body hover:text-ink'
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}

// Shared frame of the edition sub-pages: loads the edition for the heading, then shows the tabs and the page (given the edition)
export function EditionSection({ editionId, intro, actions, children }: { editionId: string; intro: string; actions?: React.ReactNode; children: (edition: Edition) => React.ReactNode }) {
  const { data: edition, error } = useLoad(() => getEdition(editionId), [editionId]);
  if (error) return <p role="alert" className="text-sm text-red-700">{error}</p>;
  if (!edition) return <Loading />;
  return (
    <section>
      <PageHeader title={edition.name} intro={intro} back={{ to: `/events/${edition.series_id}`, label: `Back to ${edition.series_name}` }}>
        {actions}
      </PageHeader>
      <EditionTabs editionId={editionId} />
      {children(edition)}
    </section>
  );
}
