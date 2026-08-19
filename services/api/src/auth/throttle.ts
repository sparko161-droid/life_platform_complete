/**
 * Sign-in attempt throttling (P1-031).
 *
 * P1-030's handoff flagged this explicitly: Argon2id makes each attempt
 * expensive, but expense is a cost, not a limit. `docs/security/threat-model.md`
 * names account takeover as a top threat, so a bounded number of attempts
 * per identifier is a control, not a nicety.
 *
 * In-memory on purpose, and its limits are stated rather than implied:
 * this holds only within one process, so it does not survive a restart
 * and does not coordinate across instances. That is honest for Phase 1
 * (single API process, no horizontal scale yet) and is exactly what
 * `docs/architecture/data-architecture.md` already names Redis for when
 * it stops being true. Recorded as a known limitation rather than
 * presented as complete rate limiting.
 *
 * Keyed by email **and** client address, so one attacker cannot lock a
 * victim out of their own account by burning the attempt budget from
 * elsewhere -- lockout as a denial-of-service is a real failure mode of
 * naive per-account throttling.
 */

export interface ThrottleDecision {
  allowed: boolean;
  /** Seconds until the next attempt is permitted; 0 when allowed. */
  retryAfterSeconds: number;
}

interface Bucket {
  failures: number;
  firstFailureAt: number;
  blockedUntil: number;
}

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;
const BLOCK_MS = 15 * 60 * 1000;

export class SignInThrottle {
  private readonly buckets = new Map<string, Bucket>();

  private key(identifier: string, clientAddress: string): string {
    return `${identifier.toLowerCase()}|${clientAddress}`;
  }

  check(identifier: string, clientAddress: string, now = Date.now()): ThrottleDecision {
    const bucket = this.buckets.get(this.key(identifier, clientAddress));
    if (!bucket) return { allowed: true, retryAfterSeconds: 0 };

    if (bucket.blockedUntil > now) {
      return { allowed: false, retryAfterSeconds: Math.ceil((bucket.blockedUntil - now) / 1000) };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }

  recordFailure(identifier: string, clientAddress: string, now = Date.now()): void {
    const key = this.key(identifier, clientAddress);
    const bucket = this.buckets.get(key);

    if (!bucket || now - bucket.firstFailureAt > WINDOW_MS) {
      this.buckets.set(key, { failures: 1, firstFailureAt: now, blockedUntil: 0 });
      return;
    }

    bucket.failures += 1;
    if (bucket.failures >= MAX_FAILURES) {
      bucket.blockedUntil = now + BLOCK_MS;
      bucket.failures = 0;
      bucket.firstFailureAt = now;
    }
  }

  /** A successful sign-in clears the record -- the budget is for failures. */
  recordSuccess(identifier: string, clientAddress: string): void {
    this.buckets.delete(this.key(identifier, clientAddress));
  }

  /** Test-only: drop all state. */
  reset(): void {
    this.buckets.clear();
  }
}

/** One shared instance; see the module docstring on why in-memory. */
export const signInThrottle = new SignInThrottle();
