/** Allows short bursts but caps the sustained number of calls per second. */
export class TokenBucketLimiter {
  private available: number;
  private lastRefill: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    now = Date.now(),
  ) {
    this.available = capacity;
    this.lastRefill = now;
  }

  tryAcquire(now = Date.now()): boolean {
    this.refill(now);
    if (this.available < 1) return false;
    this.available -= 1;
    return true;
  }

  private refill(now: number): void {
    const elapsedSeconds = (now - this.lastRefill) / 1000;
    this.available = Math.min(
      this.capacity,
      this.available + elapsedSeconds * this.refillPerSecond,
    );
    this.lastRefill = now;
  }
}
