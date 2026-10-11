import { ApiError, api } from './api';
import type { StaffMember, StaffRole } from './types';
import type { CreateStaffInput } from './staffValidation';

export type Result = { ok: true } | { ok: false; error: string };

// The server's message, or the first field problem when it sent field-level errors
function failure(e: unknown, fallback: string): Result {
  if (!(e instanceof ApiError)) return { ok: false, error: fallback };
  const field = e.fields && Object.values(e.fields)[0];
  return { ok: false, error: field ?? e.message };
}

async function attempt(run: () => Promise<unknown>, fallback: string): Promise<Result> {
  try {
    await run();
    return { ok: true };
  } catch (e) {
    return failure(e, fallback);
  }
}

export async function listStaff(): Promise<StaffMember[]> {
  try {
    return await api.get<StaffMember[]>('/staff');
  } catch {
    throw new Error("Staff couldn't be loaded. Refresh to try again.");
  }
}

// No emails are sent: the admin passes the temporary password on to the person directly
export const createStaff = (input: CreateStaffInput) =>
  attempt(() => api.post('/staff', input), "The account couldn't be created. Try again.");

export const resetStaffPassword = (id: string, tempPassword: string) =>
  attempt(() => api.post(`/staff/${id}/reset-password`, { temp_password: tempPassword }), "The password couldn't be reset. Try again.");

export const updateStaff = (id: string, patch: { full_name?: string; role?: StaffRole; active?: boolean }) =>
  attempt(() => api.patch(`/staff/${id}`, patch), "The change couldn't be saved. Try again.");
