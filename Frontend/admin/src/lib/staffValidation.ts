// Instant checks in the browser before sending; the MEDIUM server (server/src/staff/routes.ts) applies the same rules again.

import type { StaffRole } from './types';

const ROLES: StaffRole[] = ['admin', 'sales', 'events', 'finance'];
export const MIN_PASSWORD_LENGTH = 10;

export type CreateStaffInput = { email: string; full_name: string; role: StaffRole; temp_password: string };
export type ResetPasswordInput = { user_id: string; temp_password: string };
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const passwordError = (password: unknown) =>
  typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH
    ? `The temporary password needs at least ${MIN_PASSWORD_LENGTH} characters.`
    : null;

export function validateCreateStaff(input: unknown): Result<CreateStaffInput> {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Invalid request.' };
  const { email, full_name, role, temp_password } = input as Record<string, unknown>;

  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return { ok: false, error: 'Enter a valid email address.' };

  const cleanName = typeof full_name === 'string' ? full_name.trim() : '';
  if (!cleanName) return { ok: false, error: "Enter the person's name." };

  if (typeof role !== 'string' || !ROLES.includes(role as StaffRole)) return { ok: false, error: 'Choose a role.' };

  const pwError = passwordError(temp_password);
  if (pwError) return { ok: false, error: pwError };

  return { ok: true, value: { email: cleanEmail, full_name: cleanName, role: role as StaffRole, temp_password: temp_password as string } };
}

export function validateResetPassword(input: unknown): Result<ResetPasswordInput> {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Invalid request.' };
  const { user_id, temp_password } = input as Record<string, unknown>;
  if (typeof user_id !== 'string' || !user_id) return { ok: false, error: 'Invalid request.' };
  const pwError = passwordError(temp_password);
  if (pwError) return { ok: false, error: pwError };
  return { ok: true, value: { user_id, temp_password: temp_password as string } };
}
