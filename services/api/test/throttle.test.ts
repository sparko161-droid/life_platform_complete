/**
 * Sign-in throttling (P1-031).
 *
 * Pure in-memory logic, so no database and no skip guard -- these run
 * everywhere.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { SignInThrottle, type ThrottleDecision } from "../src/auth/throttle.js";

const EMAIL = "parent@example.test";
const IP = "203.0.113.10";
const T0 = 1_700_000_000_000;

function failTimes(t: SignInThrottle, n: number, email = EMAIL, ip = IP, at = T0): void {
  for (let i = 0; i < n; i++) t.recordFailure(email, ip, at);
}

test("a fresh identifier is allowed", () => {
  const t = new SignInThrottle();
  const decision: ThrottleDecision = t.check(EMAIL, IP, T0);
  assert.equal(decision.allowed, true);
  assert.equal(decision.retryAfterSeconds, 0);
});

test("failures below the limit do not block", () => {
  const t = new SignInThrottle();
  failTimes(t, 9);
  assert.equal(t.check(EMAIL, IP, T0).allowed, true);
});

test("hitting the limit blocks, and reports how long to wait", () => {
  const t = new SignInThrottle();
  failTimes(t, 10);
  const decision = t.check(EMAIL, IP, T0);
  assert.equal(decision.allowed, false);
  assert.ok(decision.retryAfterSeconds > 0, "a blocked caller must be told when to retry");
});

test("the block lifts once its window passes", () => {
  const t = new SignInThrottle();
  failTimes(t, 10);
  assert.equal(t.check(EMAIL, IP, T0).allowed, false);
  const afterBlock = T0 + 15 * 60 * 1000 + 1;
  assert.equal(t.check(EMAIL, IP, afterBlock).allowed, true);
});

test("one attacker cannot lock a victim out of their own account from elsewhere", () => {
  // Naive per-account throttling turns lockout into a denial of service:
  // anyone who knows an email can burn its attempt budget. Keying on
  // email *and* client address is what prevents that.
  const t = new SignInThrottle();
  failTimes(t, 10, EMAIL, "198.51.100.7");
  assert.equal(t.check(EMAIL, "198.51.100.7", T0).allowed, false, "the attacker's own address is blocked");
  assert.equal(t.check(EMAIL, IP, T0).allowed, true, "the real owner, elsewhere, is unaffected");
});

test("failures outside the window do not accumulate toward a block", () => {
  const t = new SignInThrottle();
  failTimes(t, 9);
  // A single failure long afterwards starts a fresh window rather than
  // tipping a stale count over the limit.
  t.recordFailure(EMAIL, IP, T0 + 16 * 60 * 1000);
  assert.equal(t.check(EMAIL, IP, T0 + 16 * 60 * 1000).allowed, true);
});

test("a successful sign-in clears the failure record", () => {
  const t = new SignInThrottle();
  failTimes(t, 9);
  t.recordSuccess(EMAIL, IP);
  failTimes(t, 9);
  assert.equal(t.check(EMAIL, IP, T0).allowed, true, "the budget is for consecutive failures, not lifetime ones");
});

test("different accounts from the same address are throttled independently", () => {
  const t = new SignInThrottle();
  failTimes(t, 10, "victim@example.test");
  assert.equal(t.check("victim@example.test", IP, T0).allowed, false);
  assert.equal(t.check("someone-else@example.test", IP, T0).allowed, true);
});

test("the identifier is matched case-insensitively", () => {
  // Otherwise Parent@x and parent@x would each get a full budget, which
  // is the same normalisation gap the account table closes with
  // UNIQUE(LOWER(email)).
  const t = new SignInThrottle();
  failTimes(t, 10, "Parent@Example.test");
  assert.equal(t.check("parent@example.test", IP, T0).allowed, false);
});
