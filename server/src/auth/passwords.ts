import bcrypt from 'bcryptjs';

export const MIN_PASSWORD_LENGTH = 10;

let cost = 12;
// Tests lower the bcrypt cost so they run quickly; production always uses 12
export function setPasswordCost(value: number) {
  cost = value;
}

export const hashPassword = (password: string) => bcrypt.hash(password, cost);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

// A real hash of a random string, compared against when the email is unknown, so a wrong email
// takes as long as a wrong password and can't be detected by timing
let dummyHash: string | null = null;
export async function verifyAgainstDummy(password: string) {
  dummyHash ??= await bcrypt.hash('not-a-real-password', cost);
  await bcrypt.compare(password, dummyHash);
  return false;
}
