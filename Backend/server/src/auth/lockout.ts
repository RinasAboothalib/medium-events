// Locks an email for 15 minutes after 5 failed sign-ins within 15 minutes.
// Kept in memory: a server restart clears it, which is acceptable for a small staff tool.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

export class Lockout {
  private failures = new Map<string, number[]>();
  private lockedUntil = new Map<string, number>();

  isLocked(email: string, now: Date): boolean {
    const until = this.lockedUntil.get(email);
    if (until === undefined) return false;
    if (now.getTime() >= until) {
      this.lockedUntil.delete(email);
      this.failures.delete(email);
      return false;
    }
    return true;
  }

  recordFailure(email: string, now: Date) {
    const recent = (this.failures.get(email) ?? []).filter((t) => now.getTime() - t < WINDOW_MS);
    recent.push(now.getTime());
    this.failures.set(email, recent);
    if (recent.length >= MAX_FAILURES) this.lockedUntil.set(email, now.getTime() + WINDOW_MS);
  }

  reset(email: string) {
    this.failures.delete(email);
    this.lockedUntil.delete(email);
  }
}
