import assert from "node:assert/strict";
import { test } from "node:test";
import { SCREENS } from "@life/ux-contracts";
import { cardInvitation, deriveTodayState, type TodayCard } from "../lib/today.js";

/**
 * C-TODAY state derivation (P1-004).
 *
 * The interesting assertions are about precedence — which state wins
 * when several are true at once — because that is the part a reader
 * cannot recover from the code by inspection, and the part a later edit
 * can silently reverse.
 */

const NOW = new Date("2026-06-01T12:00:00.000Z");

function card(overrides: Partial<TodayCard> = {}): TodayCard {
  return {
    taskAssignmentId: "a1",
    title: "Убрать со стола",
    status: "ASSIGNED",
    rewardXp: 10,
    rewardCoins: 0,
    ...overrides,
  };
}

const base = { online: true, syncFailed: false, everHadTasks: true, now: NOW };

test("offline outranks everything, because everything else describes data we may not have", () => {
  const state = deriveTodayState({
    ...base,
    online: false,
    syncFailed: true,
    cards: [card({ dueAt: "2026-01-01T00:00:00.000Z" })],
  });
  assert.equal(state, "OFFLINE");
});

test("a failed sync is reported rather than shown as an empty day", () => {
  // Rendering NO_TASKS after a failed fetch would tell a child their
  // tasks are gone, which is a different and much worse claim.
  assert.equal(deriveTodayState({ ...base, syncFailed: true, cards: null }), "FAILED_SYNC");
});

test("an empty day distinguishes a first day from a quiet one", () => {
  assert.equal(deriveTodayState({ ...base, cards: [], everHadTasks: false }), "FIRST_DAY");
  assert.equal(deriveTodayState({ ...base, cards: [], everHadTasks: true }), "NO_TASKS");
});

test("overdue outranks all-complete", () => {
  // Something needing attention matters more than celebrating the rest.
  const state = deriveTodayState({
    ...base,
    cards: [card({ status: "COMPLETED" }), card({ taskAssignmentId: "a2", dueAt: "2026-05-01T00:00:00.000Z" })],
  });
  assert.equal(state, "OVERDUE");
});

test("a settled card is never overdue, however long ago it was due", () => {
  const state = deriveTodayState({
    ...base,
    cards: [card({ status: "COMPLETED", dueAt: "2026-01-01T00:00:00.000Z" })],
  });
  assert.equal(state, "ALL_COMPLETE");
});

test("a due date still in the future is not overdue", () => {
  const state = deriveTodayState({ ...base, cards: [card({ dueAt: "2026-07-01T00:00:00.000Z" })] });
  assert.equal(state, "NORMAL_DAY");
});

test("APPROVED counts as done even before the reward is ledgered", () => {
  assert.equal(deriveTodayState({ ...base, cards: [card({ status: "APPROVED" })] }), "ALL_COMPLETE");
});

test("a rejected card leaves the day ordinary, not complete", () => {
  // REJECTED means there is still something to do; calling the day
  // finished would be wrong and would hide the retry.
  assert.equal(deriveTodayState({ ...base, cards: [card({ status: "REJECTED" })] }), "NORMAL_DAY");
});

test("every state the derivation can produce is one C-TODAY declares", () => {
  const declared = new Set<string>(SCREENS["C-TODAY"].states);
  const produced = [
    deriveTodayState({ ...base, cards: null, online: false }),
    deriveTodayState({ ...base, cards: null, syncFailed: true }),
    deriveTodayState({ ...base, cards: [], everHadTasks: false }),
    deriveTodayState({ ...base, cards: [], everHadTasks: true }),
    deriveTodayState({ ...base, cards: [card({ dueAt: "2026-01-01T00:00:00.000Z" })] }),
    deriveTodayState({ ...base, cards: [card({ status: "COMPLETED" })] }),
    deriveTodayState({ ...base, cards: [card()] }),
  ];
  // Also asserts the inverse of what the type system checks: the screen
  // renders every declared state, and the derivation reaches all seven.
  assert.equal(new Set(produced).size, declared.size);
  for (const state of produced) assert.ok(declared.has(state), `${state} is not declared by C-TODAY`);
});

test("a card never invites the child with a raw status", () => {
  // docs/ux/ui-language.md: internal labels are prohibited. "SUBMITTED"
  // in front of a seven-year-old is the failure this guards.
  for (const status of ["ASSIGNED", "IN_PROGRESS", "SUBMITTED", "VERIFYING", "APPROVED", "COMPLETED", "REJECTED"]) {
    const label = cardInvitation(status);
    assert.ok(label.length > 0);
    assert.doesNotMatch(label, /[A-Za-z]/u, `${status} leaks a Latin-script label: ${label}`);
  }
});

test("an unfamiliar status from a newer server still yields something to tap", () => {
  // Never a dead end, even when the client is older than the server.
  assert.equal(cardInvitation("SOME_FUTURE_STATUS"), "Открыть");
});
