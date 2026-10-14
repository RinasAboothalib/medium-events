// Allows `max` requests per key (an IP address) within a sliding window. In memory: a restart clears it.
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private max: number,
    private windowMs: number,
  ) {}

  // Records the attempt and says whether it is allowed
  allow(key: string, now: Date): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now.getTime() - t < this.windowMs);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now.getTime());
    this.hits.set(key, recent);
    return true;
  }
}
