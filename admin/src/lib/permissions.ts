import { can as serverCan, type Permission } from '../../../server/src/permissions.ts';
import type { StaffRole } from './types';

// Which sections each role sees. Uses the server's own permission table, so the menu always
// matches what the server allows; the server still checks every request.
export type { Permission };
export const can = (role: StaffRole | null | undefined, permission: Permission) => !!role && serverCan(role, permission);

export type SectionId = 'dashboard' | 'events' | 'publish' | 'enquiries' | 'sponsors' | 'deals' | 'reports' | 'staff' | 'activity' | 'account';

// permission: null = everyone; a list = anyone with at least one of them
export const NAV_ITEMS: { id: SectionId; label: string; path: string; permission: Permission | Permission[] | null }[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/', permission: null },
  { id: 'events', label: 'Events', path: '/events', permission: 'events.read' },
  { id: 'publish', label: 'Publish', path: '/publish', permission: 'events.publish' },
  { id: 'enquiries', label: 'Enquiries', path: '/enquiries', permission: 'enquiries.access' },
  { id: 'sponsors', label: 'Sponsors', path: '/sponsors', permission: 'sponsors.read' },
  { id: 'deals', label: 'Deals', path: '/deals', permission: 'deals.read' },
  { id: 'reports', label: 'Reports', path: '/reports', permission: ['reports.postEvent', 'reports.sponsorship', 'reports.enquiries', 'reports.delegates', 'reports.budget'] },
  { id: 'staff', label: 'Staff', path: '/staff', permission: 'staff.write' },
  { id: 'activity', label: 'Activity log', path: '/activity', permission: null },
  { id: 'account', label: 'My account', path: '/account', permission: null },
];

export function canSee(role: StaffRole, section: SectionId): boolean {
  const item = NAV_ITEMS.find((i) => i.id === section)!;
  if (item.permission === null) return true;
  return (Array.isArray(item.permission) ? item.permission : [item.permission]).some((p) => can(role, p));
}

export function rolesFor(section: SectionId): StaffRole[] {
  return (['admin', 'sales', 'events', 'finance'] as StaffRole[]).filter((role) => canSee(role, section));
}

// Roles holding a permission, for guarding a page that isn't a menu section
export const rolesWith = (permission: Permission): StaffRole[] => (['admin', 'sales', 'events', 'finance'] as StaffRole[]).filter((role) => can(role, permission));

export const navFor = (role: StaffRole | null) => NAV_ITEMS.filter((item) => role && canSee(role, item.id));
