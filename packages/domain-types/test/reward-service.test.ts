/**
 * Tests for the reward ledger and catalog domain service (P1-006).
 *
 * Strategy per task-registry (test_strategy: "Ledger invariants,
 * duplicate-write, replay and reward calculation tests."):
 *   - Ledger invariants: balance derived from append-only entries
 *   - Duplicate-write: idempotencyKey prevents double-granting
 *   - Replay: same command on existing entries returns duplicate=true
 *   - Reward calculation: grantTaskReward XP+COINS amounts
 *   - Catalog lifecycle: LOCKED → AVAILABLE → REDEEMING → REDEEMED
 *   - Compensating events: cancelRedemption returns AVAILABLE
 *   - Integration: full task-approval → ledger → redemption flow
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { RewardId } from "../src/ids.js";
import type { RewardLedgerEntry } from "../src/reward.js";
import {
  RewardDomainError,
  activateReward,
  adjustBalance,
  cancelRedemption,
  cancelReward,
  computeBalance,
  confirmRedemption,
  createReward,
  expireReward,
  findDuplicateEntry,
  grantStreakBonus,
  grantTaskReward,
  initiateRedemption,
} from "../src/reward-service.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FAMILY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as const;
const CHILD_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" as const;
const PARENT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc" as const;
const TASK_ASSIGNMENT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd" as const;
const REWARD_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" as RewardId;
const NOW = "2026-08-18T12:00:00.000Z";

function noEntries(): RewardLedgerEntry[] {
  return [];
}

// ---------------------------------------------------------------------------
// computeBalance
// ---------------------------------------------------------------------------

test("computeBalance: zero for an empty ledger", () => {
  assert.equal(computeBalance([], "XP"), 0);
  assert.equal(computeBalance([], "COINS"), 0);
});

test("computeBalance: sums positive entries for the requested kind", () => {
  const entries = [
    { kind: "XP", amount: 100 } as unknown as RewardLedgerEntry,
    { kind: "XP", amount: 50 } as unknown as RewardLedgerEntry,
    { kind: "COINS", amount: 20 } as unknown as RewardLedgerEntry,
  ];
  assert.equal(computeBalance(entries, "XP"), 150);
  assert.equal(computeBalance(entries, "COINS"), 20);
});

test("computeBalance: handles negative entries (deductions)", () => {
  const entries = [
    { kind: "COINS", amount: 100 } as unknown as RewardLedgerEntry,
    { kind: "COINS", amount: -30 } as unknown as RewardLedgerEntry,
  ];
  assert.equal(computeBalance(entries, "COINS"), 70);
});

test("computeBalance: ignores other kinds", () => {
  const entries = [
    { kind: "MONEY", amount: 999 } as unknown as RewardLedgerEntry,
  ];
  assert.equal(computeBalance(entries, "XP"), 0);
});

// ---------------------------------------------------------------------------
// findDuplicateEntry
// ---------------------------------------------------------------------------

test("findDuplicateEntry: returns undefined when no match", () => {
  assert.equal(findDuplicateEntry([], "key-1"), undefined);
});

test("findDuplicateEntry: returns matching entry", () => {
  const entry = { idempotencyKey: "key-1" } as unknown as RewardLedgerEntry;
  const result = findDuplicateEntry([entry], "key-1");
  assert.strictEqual(result, entry);
});

// ---------------------------------------------------------------------------
// grantTaskReward
// ---------------------------------------------------------------------------

test("grantTaskReward: creates XP and COINS entries on first call", () => {
  const result = grantTaskReward(noEntries(), {
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    sourceTaskAssignmentId: TASK_ASSIGNMENT_ID,
    xpAmount: 100,
    coinsAmount: 50,
    now: NOW,
  });
  assert.ok(result.xp);
  assert.ok(result.coins);
  assert.equal(result.xp.duplicate, false);
  assert.equal(result.coins.duplicate, false);
  assert.equal(result.xp.entry.amount, 100);
  assert.equal(result.xp.entry.kind, "XP");
  assert.equal(result.coins.entry.amount, 50);
  assert.equal(result.coins.entry.kind, "COINS");
  assert.equal(result.xp.entry.reason, "TASK_COMPLETION");
  assert.equal(result.xp.events.length, 1);
  assert.equal(result.xp.events[0]!.eventType, "XP_GRANTED");
});

test("grantTaskReward: emits COINS_GRANTED event for coins", () => {
  const result = grantTaskReward(noEntries(), {
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    sourceTaskAssignmentId: TASK_ASSIGNMENT_ID,
    xpAmount: 0,
    coinsAmount: 30,
    now: NOW,
  });
  assert.equal(result.xp, undefined);
  assert.ok(result.coins);
  assert.equal(result.coins.events[0]!.eventType, "COINS_GRANTED");
});

test("grantTaskReward: idempotent — returns duplicate=true on replay", () => {
  const first = grantTaskReward(noEntries(), {
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    sourceTaskAssignmentId: TASK_ASSIGNMENT_ID,
    xpAmount: 100,
    coinsAmount: 0,
    now: NOW,
  });
  const existingXp = first.xp!.entry;

  // Replay with the existing entry in the set
  const second = grantTaskReward([existingXp], {
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    sourceTaskAssignmentId: TASK_ASSIGNMENT_ID,
    xpAmount: 100,
    coinsAmount: 0,
    now: NOW,
  });

  assert.equal(second.xp!.duplicate, true);
  assert.equal(second.xp!.events.length, 0);
  assert.strictEqual(second.xp!.entry, existingXp);
});

test("grantTaskReward: rejects negative amounts", () => {
  assert.throws(
    () =>
      grantTaskReward(noEntries(), {
        familyId: FAMILY_ID,
        childId: CHILD_ID,
        sourceTaskAssignmentId: TASK_ASSIGNMENT_ID,
        xpAmount: -10,
        coinsAmount: 0,
        now: NOW,
      }),
    (err: unknown) => {
      assert.ok(err instanceof RewardDomainError);
      assert.equal(err.code, "INVALID_REWARD_AMOUNT");
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// grantStreakBonus
// ---------------------------------------------------------------------------

test("grantStreakBonus: creates a STREAK_BONUS entry", () => {
  const result = grantStreakBonus(noEntries(), {
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    kind: "XP",
    amount: 25,
    idempotencyKey: "streak-7day-2026-08-18",
    now: NOW,
  });
  assert.equal(result.duplicate, false);
  assert.equal(result.entry.reason, "STREAK_BONUS");
  assert.equal(result.entry.amount, 25);
  assert.equal(result.entry.kind, "XP");
  assert.equal(result.events[0]!.eventType, "XP_GRANTED");
});

test("grantStreakBonus: idempotent on replay", () => {
  const first = grantStreakBonus(noEntries(), {
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    kind: "COINS",
    amount: 10,
    idempotencyKey: "streak-key",
    now: NOW,
  });
  const second = grantStreakBonus([first.entry], {
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    kind: "COINS",
    amount: 10,
    idempotencyKey: "streak-key",
    now: NOW,
  });
  assert.equal(second.duplicate, true);
  assert.equal(second.events.length, 0);
});

test("grantStreakBonus: rejects amount <= 0", () => {
  assert.throws(
    () =>
      grantStreakBonus(noEntries(), {
        familyId: FAMILY_ID,
        childId: CHILD_ID,
        kind: "XP",
        amount: 0,
        idempotencyKey: "key",
        now: NOW,
      }),
    (err: unknown) => {
      assert.ok(err instanceof RewardDomainError);
      assert.equal(err.code, "INVALID_REWARD_AMOUNT");
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// adjustBalance
// ---------------------------------------------------------------------------

test("adjustBalance: creates a PARENT_ADJUSTMENT entry for a grant", () => {
  const result = adjustBalance(noEntries(), {
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    parentId: PARENT_ID,
    kind: "COINS",
    amount: 100,
    idempotencyKey: "adj-1",
    now: NOW,
  });
  assert.equal(result.entry.reason, "PARENT_ADJUSTMENT");
  assert.equal(result.entry.amount, 100);
  assert.equal(result.duplicate, false);
});

test("adjustBalance: supports negative amounts (deductions)", () => {
  const result = adjustBalance(noEntries(), {
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    parentId: PARENT_ID,
    kind: "COINS",
    amount: -20,
    idempotencyKey: "adj-2",
    now: NOW,
  });
  assert.equal(result.entry.amount, -20);
});

test("adjustBalance: rejects zero amount", () => {
  assert.throws(
    () =>
      adjustBalance(noEntries(), {
        familyId: FAMILY_ID,
        childId: CHILD_ID,
        parentId: PARENT_ID,
        kind: "COINS",
        amount: 0,
        idempotencyKey: "adj-3",
        now: NOW,
      }),
    (err: unknown) => {
      assert.ok(err instanceof RewardDomainError);
      assert.equal(err.code, "ADJUSTMENT_AMOUNT_ZERO");
      return true;
    },
  );
});

test("adjustBalance: idempotent on replay", () => {
  const first = adjustBalance(noEntries(), {
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    parentId: PARENT_ID,
    kind: "XP",
    amount: 50,
    idempotencyKey: "adj-4",
    now: NOW,
  });
  const second = adjustBalance([first.entry], {
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    parentId: PARENT_ID,
    kind: "XP",
    amount: 50,
    idempotencyKey: "adj-4",
    now: NOW,
  });
  assert.equal(second.duplicate, true);
});

test("adjustBalance: MONEY kind emits MONEY_LEDGER_POSTED", () => {
  const result = adjustBalance(noEntries(), {
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    parentId: PARENT_ID,
    kind: "MONEY",
    amount: 1000,
    idempotencyKey: "money-1",
    now: NOW,
  });
  assert.equal(result.events[0]!.eventType, "MONEY_LEDGER_POSTED");
});

// ---------------------------------------------------------------------------
// Reward catalog lifecycle
// ---------------------------------------------------------------------------

test("createReward: creates a LOCKED reward", () => {
  const { next, events } = createReward({
    rewardId: REWARD_ID,
    familyId: FAMILY_ID,
    createdByParentId: PARENT_ID,
    title: "Ice cream trip",
    type: "ACTIVITY",
    now: NOW,
  });
  assert.equal(next.status, "LOCKED");
  assert.equal(next.version, 1);
  assert.equal(next.title, "Ice cream trip");
  assert.equal(events.length, 0);
});

test("activateReward: transitions LOCKED → AVAILABLE and emits REWARD_UNLOCKED", () => {
  const { next: locked } = createReward({
    rewardId: REWARD_ID,
    familyId: FAMILY_ID,
    createdByParentId: PARENT_ID,
    title: "Treat",
    type: "COUPON",
    now: NOW,
  });
  const { next: available, events } = activateReward(locked, PARENT_ID, NOW);
  assert.equal(available.status, "AVAILABLE");
  assert.equal(available.version, 2);
  assert.equal(events[0]!.eventType, "REWARD_UNLOCKED");
});

test("activateReward: rejects transition from REDEEMED", () => {
  const { next: locked } = createReward({ rewardId: REWARD_ID, familyId: FAMILY_ID, createdByParentId: PARENT_ID, title: "T", type: "XP", now: NOW });
  const { next: available } = activateReward(locked, PARENT_ID, NOW);
  // Construct a REDEEMED reward directly to test the invalid transition
  const redeemedReward = { ...available, status: "REDEEMED" as const, version: 4 };
  assert.throws(
    () => activateReward(redeemedReward, PARENT_ID, NOW),
    (err: unknown) => {
      assert.ok(err instanceof RewardDomainError);
      assert.equal(err.code, "INVALID_REWARD_TRANSITION");
      return true;
    },
  );
});

test("initiateRedemption: transitions AVAILABLE → REDEEMING", () => {
  const { next: locked } = createReward({ rewardId: REWARD_ID, familyId: FAMILY_ID, createdByParentId: PARENT_ID, title: "T", type: "COINS", now: NOW });
  const { next: available } = activateReward(locked, PARENT_ID, NOW);
  const { next: redeeming } = initiateRedemption(available, { familyId: FAMILY_ID, childId: CHILD_ID, now: NOW });
  assert.equal(redeeming.status, "REDEEMING");
  assert.equal(redeeming.version, 3);
});

test("initiateRedemption: rejects when not AVAILABLE", () => {
  const { next: locked } = createReward({ rewardId: REWARD_ID, familyId: FAMILY_ID, createdByParentId: PARENT_ID, title: "T", type: "XP", now: NOW });
  assert.throws(
    () => initiateRedemption(locked, { familyId: FAMILY_ID, childId: CHILD_ID, now: NOW }),
    (err: unknown) => {
      assert.ok(err instanceof RewardDomainError);
      assert.equal(err.code, "INVALID_REWARD_STATUS");
      return true;
    },
  );
});

test("cancelRedemption: returns REDEEMING → AVAILABLE (compensating)", () => {
  const { next: locked } = createReward({ rewardId: REWARD_ID, familyId: FAMILY_ID, createdByParentId: PARENT_ID, title: "T", type: "COINS", now: NOW });
  const { next: available } = activateReward(locked, PARENT_ID, NOW);
  const { next: redeeming } = initiateRedemption(available, { familyId: FAMILY_ID, childId: CHILD_ID, now: NOW });
  const { next: backToAvailable } = cancelRedemption(redeeming, PARENT_ID, NOW);
  assert.equal(backToAvailable.status, "AVAILABLE");
  assert.equal(backToAvailable.version, 4);
});

test("expireReward: transitions AVAILABLE → EXPIRED", () => {
  const { next: locked } = createReward({ rewardId: REWARD_ID, familyId: FAMILY_ID, createdByParentId: PARENT_ID, title: "T", type: "XP", now: NOW });
  const { next: available } = activateReward(locked, PARENT_ID, NOW);
  const { next: expired } = expireReward(available, PARENT_ID, NOW);
  assert.equal(expired.status, "EXPIRED");
});

test("cancelReward: transitions LOCKED → CANCELLED", () => {
  const { next: locked } = createReward({ rewardId: REWARD_ID, familyId: FAMILY_ID, createdByParentId: PARENT_ID, title: "T", type: "XP", now: NOW });
  const { next: cancelled } = cancelReward(locked, PARENT_ID, NOW);
  assert.equal(cancelled.status, "CANCELLED");
});

// ---------------------------------------------------------------------------
// Integration: task approval → ledger → reward redemption
// ---------------------------------------------------------------------------

test("integration: task approved → XP+COINS granted → reward redeemed → balance reflects all entries", () => {
  // 1. Task approved: grant XP and COINS
  const grantResult = grantTaskReward(noEntries(), {
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    sourceTaskAssignmentId: TASK_ASSIGNMENT_ID,
    xpAmount: 100,
    coinsAmount: 50,
    now: NOW,
  });

  const ledger: RewardLedgerEntry[] = [
    grantResult.xp!.entry,
    grantResult.coins!.entry,
  ];

  // 2. Balance before redemption
  assert.equal(computeBalance(ledger, "XP"), 100);
  assert.equal(computeBalance(ledger, "COINS"), 50);

  // 3. Parent creates and activates a reward
  const { next: locked } = createReward({
    rewardId: REWARD_ID,
    familyId: FAMILY_ID,
    createdByParentId: PARENT_ID,
    title: "Movie night",
    type: "ACTIVITY",
    now: NOW,
  });
  const { next: available } = activateReward(locked, PARENT_ID, NOW);

  // 4. Child initiates redemption
  const { next: redeeming } = initiateRedemption(available, { familyId: FAMILY_ID, childId: CHILD_ID, now: NOW });

  // 5. Parent confirms redemption
  const { next: redeemed, ledgerEntry } = confirmRedemption(redeeming, ledger, {
    actorId: PARENT_ID,
    now: NOW,
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    idempotencyKey: `redeem-${REWARD_ID}`,
  });

  assert.equal(redeemed.status, "REDEEMED");
  assert.equal(ledgerEntry.duplicate, false);

  // 6. Replay confirm on the same still-REDEEMING state with same idempotency key is idempotent
  const { ledgerEntry: replayLedger } = confirmRedemption(redeeming, [...ledger, ledgerEntry.entry], {
    actorId: PARENT_ID,
    now: NOW,
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    idempotencyKey: `redeem-${REWARD_ID}`,
  });
  assert.equal(replayLedger.duplicate, true);
});
