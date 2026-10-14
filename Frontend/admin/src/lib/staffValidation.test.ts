import { describe, expect, it } from 'vitest';
import { validateCreateStaff, validateResetPassword } from './staffValidation';

const good = { email: '  Aisha@Medium.MV ', full_name: '  Aisha Ali ', role: 'sales', temp_password: 'Temporary-123' };

describe('validateCreateStaff', () => {
  it('accepts a valid new account and normalises it', () => {
    expect(validateCreateStaff(good)).toEqual({
      ok: true,
      value: { email: 'aisha@medium.mv', full_name: 'Aisha Ali', role: 'sales', temp_password: 'Temporary-123' },
    });
  });

  it('rejects a bad email', () => {
    expect(validateCreateStaff({ ...good, email: 'not-an-email' })).toEqual({ ok: false, error: 'Enter a valid email address.' });
  });

  it('rejects a blank name', () => {
    expect(validateCreateStaff({ ...good, full_name: '   ' })).toEqual({ ok: false, error: "Enter the person's name." });
  });

  it('rejects an unknown role', () => {
    expect(validateCreateStaff({ ...good, role: 'owner' })).toEqual({ ok: false, error: 'Choose a role.' });
  });

  it('requires a temporary password of at least 10 characters', () => {
    expect(validateCreateStaff({ ...good, temp_password: 'short' })).toEqual({
      ok: false,
      error: 'The temporary password needs at least 10 characters.',
    });
  });

  it('rejects anything that is not an object', () => {
    expect(validateCreateStaff(null)).toEqual({ ok: false, error: 'Invalid request.' });
  });
});

describe('validateResetPassword', () => {
  it('accepts a user id and temporary password', () => {
    expect(validateResetPassword({ user_id: 'u-1', temp_password: 'Temporary-123' })).toEqual({
      ok: true,
      value: { user_id: 'u-1', temp_password: 'Temporary-123' },
    });
  });

  it('rejects a short password or missing user', () => {
    expect(validateResetPassword({ user_id: 'u-1', temp_password: 'short' }).ok).toBe(false);
    expect(validateResetPassword({ temp_password: 'Temporary-123' })).toEqual({ ok: false, error: 'Invalid request.' });
  });
});
