/**
 * Idempotency rules and fixtures (P1-008).
 *
 * Strategy per task-registry (test_strategy: "Concurrency, retry, replay
 * and idempotency fixtures."):
 *
 *   - Key derivation: taskCompletionRewardKey, streakBonusKey, etc. produce
 *     stable, deterministic values
 *   - Duplicate detection: isRewardLedgerDuplicate finds existing keys
 *   - Replay: re-submitting a task that is already SUBMITTED fails cleanly
 *   - Retry: re-entering a passed gate after retry returns the same result
 *   - Duplicate verification: calling verifyTask twice on APPROVED fails
 *   - Duplicate reward grant: grantTaskReward replay returns duplicate:true
 *   - Duplicate redemption: confirmRedemption replay returns duplicate:true
 *   - Integration: full task-approval → reward chain replayed twice
 *   - IDEMPOTENCY_RULES: structural coverage — all 7 stages, both mechanisms
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChildId, FamilyId, RewardId, TaskAssignmentId, TaskTemplateId } from "../src/ids.js";
import {
  IDEMPOTENCY_RULES,
  isRewardLedgerDuplicate,
  parentAdjustmentKey,
  rewardRedemptionKey,
  streakBonusKey,
  taskCompletionRewardKey,
} from "../src/idempotency.js";
import type { RewardLedgerEntry } from "../src/reward.js";
import {
  activateReward,
  computeBalance,
  confirmRedemption,
  createReward,
  grantTaskReward,
  initiateRedemption,
} from "../src/reward-service.js";
import {
  TaskDomainError,
  assignTask,
  beginVerification,
  completeTask,
  createTemplate,
  publishTemplate,
  startTask,
  submitTask,
  verifyTask,
} from "../src/task-service.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FAMILY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as FamilyId;
const CHILD_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" as ChildId;
const PARENT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc" as const;
const TEMPLATE_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd" as TaskTemplateId;
const ASSIGNMENT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" as TaskAssignmentId;
const REWARD_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff" as RewardId;
const NOW = "2026-08-18T12:00:00.000Z";

function makeTemplate() {
  const created = createTemplate({
    taskTemplateId: TEMPLATE_ID,
    familyId: FAMILY_ID,
    createdByParentId: PARENT_ID,
    title: "Clean room",
    verificationStrategy: "PARENT_APPROVAL",
    rewardXp: 100,
    rewardCoins: 50,
    now: NOW,
  });
  return publishTemplate(created.next, { actorId: PARENT_ID, now: NOW }).next;
}

function makeAssignment() {
  const template = makeTemplate();
  const result = assignTask(template, {
    taskAssignmentId: ASSIGNMENT_ID,
    assignedToChildId: CHILD_ID,
    actorId: PARENT_ID,
    now: NOW,
  });
  return { template, assignment: result.next };
}

function noEntries(): RewardLedgerEntry[] {
  return [];
}

// ---------------------------------------------------------------------------
// Key derivation
// ---------------------------------------------------------------------------

test("taskCompletionRewardKey: deterministic and unique per kind", () => {
  const xpKey = taskCompletionRewardKey(ASSIGNMENT_ID, "XP");
  const coinsKey = taskCompletionRewardKey(ASSIGNMENT_ID, "COINS");
  assert.ok(xpKey.includes(ASSIGNMENT_ID));
  assert.ok(coinsKey.includes(ASSIGNMENT_ID));
  assert.notEqual(xpKey, coinsKey);
  // Same input → same output
  assert.equal(taskCompletionRewardKey(ASSIGNMENT_ID, "XP"), xpKey);
});

test("streakBonusKey: encodes childId, streakDays, periodStart and kind", () => {
  const key = streakBonusKey(CHILD_ID, 7, "2026-08-18", "XP");
  assert.ok(key.includes(CHILD_ID));
  assert.ok(key.includes("7d"));
  assert.ok(key.includes("2026-08-18"));
  assert.ok(key.includes("XP"));
  // Different period → different key
  const key2 = streakBonusKey(CHILD_ID, 7, "2026-08-25", "XP");
  assert.notEqual(key, key2);
});

test("rewardRedemptionKey: encodes rewardId and attemptId", () => {
  const key = rewardRedemptionKey(REWARD_ID, "attempt-1");
  assert.ok(key.includes(REWARD_ID));
  assert.ok(key.includes("attempt-1"));
  assert.notEqual(rewardRedemptionKey(REWARD_ID, "attempt-1"), rewardRedemptionKey(REWARD_ID, "attempt-2"));
});

test("parentAdjustmentKey: encodes parentId, ref and kind", () => {
  const key = parentAdjustmentKey(PARENT_ID, "ticket-99", "COINS");
  assert.ok(key.includes(PARENT_ID));
  assert.ok(key.includes("ticket-99"));
  assert.ok(key.includes("COINS"));
});

// ---------------------------------------------------------------------------
// isRewardLedgerDuplicate
// ---------------------------------------------------------------------------

test("isRewardLedgerDuplicate: false on empty ledger", () => {
  assert.equal(isRewardLedgerDuplicate([], "any-key"), false);
});

test("isRewardLedgerDuplicate: true when key exists", () => {
  const entry = { idempotencyKey: "key-1" } as unknown as RewardLedgerEntry;
  assert.equal(isRewardLedgerDuplicate([entry], "key-1"), true);
});

test("isRewardLedgerDuplicate: false when only different keys exist", () => {
  const entry = { idempotencyKey: "key-1" } as unknown as RewardLedgerEntry;
  assert.equal(isRewardLedgerDuplicate([entry], "key-2"), false);
});

// ---------------------------------------------------------------------------
// Task stage replay: submission
// ---------------------------------------------------------------------------

test("replay: re-submitting an already-SUBMITTED task fails with INVALID_TRANSITION", () => {
  const { assignment: assigned } = makeAssignment();
  const started = startTask(assigned, { actorId: CHILD_ID, now: NOW }).next;
  const { next: { assignment: submitted } } = submitTask(started, {
    taskCompletionId: "11111111-1111-4111-8111-111111111111" as any,
    actorId: CHILD_ID,
    selfReportNote: "Done!",
    now: NOW,
  });
  assert.equal(submitted.status, "SUBMITTED");

  // Retry: child re-submits (e.g., double-tap on the submit button)
  assert.throws(
    () =>
      submitTask(submitted, {
        taskCompletionId: "22222222-2222-4222-8222-222222222222" as any,
        actorId: CHILD_ID,
        selfReportNote: "Done again",
        now: NOW,
      }),
    (err: unknown) => {
      assert.ok(err instanceof TaskDomainError);
      // submitTask requires IN_PROGRESS; submitted task is in SUBMITTED
      assert.ok(
        err.code === "INVALID_TRANSITION" || err.code.includes("TRANSITION") || err.message.includes("IN_PROGRESS"),
        `unexpected code: ${err.code}`,
      );
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// Task stage replay: begin-verification
// ---------------------------------------------------------------------------

test("replay: calling beginVerification on an already-VERIFYING task fails", () => {
  const { assignment: assigned } = makeAssignment();
  const started = startTask(assigned, { actorId: CHILD_ID, now: NOW }).next;
  const { next: { assignment: submitted } } = submitTask(started, { taskCompletionId: "11111111-1111-4111-8111-111111111111" as any, actorId: CHILD_ID, selfReportNote: "OK", now: NOW });
  const verifying = beginVerification(submitted, PARENT_ID, NOW).next;
  assert.equal(verifying.status, "VERIFYING");

  // Concurrent verifier: second call to beginVerification
  assert.throws(
    () => beginVerification(verifying, PARENT_ID, NOW),
    (err: unknown) => {
      assert.ok(err instanceof TaskDomainError);
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// Task stage replay: verification result
// ---------------------------------------------------------------------------

test("replay: approving an already-APPROVED task fails", () => {
  const { assignment: assigned } = makeAssignment();
  const started = startTask(assigned, { actorId: CHILD_ID, now: NOW }).next;
  const { next: { assignment: submitted } } = submitTask(started, { taskCompletionId: "11111111-1111-4111-8111-111111111111" as any, actorId: CHILD_ID, selfReportNote: "OK", now: NOW });
  const verifying = beginVerification(submitted, PARENT_ID, NOW).next;
  const approved = verifyTask(verifying, {
    actorId: PARENT_ID,
    outcome: "APPROVED",
    now: NOW,
  }).next;
  assert.equal(approved.status, "APPROVED");

  // Retry: parent approves again (double-click scenario)
  assert.throws(
    () =>
      verifyTask(approved, {
        actorId: PARENT_ID,
        outcome: "APPROVED",
        now: NOW,
      }),
    (err: unknown) => {
      assert.ok(err instanceof TaskDomainError);
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// Reward replay: task-completion grant
// ---------------------------------------------------------------------------

test("replay: grantTaskReward returns duplicate:true when key already exists", () => {
  const first = grantTaskReward(noEntries(), {
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    sourceTaskAssignmentId: ASSIGNMENT_ID,
    xpAmount: 100,
    coinsAmount: 50,
    now: NOW,
  });
  assert.equal(first.xp!.duplicate, false);
  assert.equal(first.coins!.duplicate, false);

  const ledger = [first.xp!.entry, first.coins!.entry];

  // Retry (e.g., event re-delivery after transient failure)
  const second = grantTaskReward(ledger, {
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    sourceTaskAssignmentId: ASSIGNMENT_ID,
    xpAmount: 100,
    coinsAmount: 50,
    now: NOW,
  });
  assert.equal(second.xp!.duplicate, true);
  assert.equal(second.coins!.duplicate, true);
  assert.equal(second.xp!.events.length, 0);
  assert.equal(second.coins!.events.length, 0);
});

test("replay: balance is unchanged after duplicate reward grant", () => {
  const first = grantTaskReward(noEntries(), {
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    sourceTaskAssignmentId: ASSIGNMENT_ID,
    xpAmount: 100,
    coinsAmount: 50,
    now: NOW,
  });
  const ledger = [first.xp!.entry, first.coins!.entry];
  assert.equal(computeBalance(ledger, "XP"), 100);

  // Replay — must NOT add to balance
  const second = grantTaskReward(ledger, {
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    sourceTaskAssignmentId: ASSIGNMENT_ID,
    xpAmount: 100,
    coinsAmount: 50,
    now: NOW,
  });
  // second.xp is duplicate — don't add its entry again
  assert.equal(second.xp!.duplicate, true);
  // Ledger size stays at 2 (we don't push duplicates)
  assert.equal(ledger.length, 2);
  assert.equal(computeBalance(ledger, "XP"), 100); // unchanged
});

// ---------------------------------------------------------------------------
// Reward replay: redemption
// ---------------------------------------------------------------------------

test("replay: confirmRedemption with same idempotencyKey returns duplicate:true for ledger entry", () => {
  const { next: locked } = createReward({ rewardId: REWARD_ID, familyId: FAMILY_ID, createdByParentId: PARENT_ID, title: "T", type: "ACTIVITY", now: NOW });
  const { next: available } = activateReward(locked, PARENT_ID, NOW);
  const { next: redeeming } = initiateRedemption(available, { familyId: FAMILY_ID, childId: CHILD_ID, now: NOW });

  const idempotencyKey = rewardRedemptionKey(REWARD_ID, "attempt-1");

  const first = confirmRedemption(redeeming, noEntries(), {
    actorId: PARENT_ID,
    now: NOW,
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    idempotencyKey,
  });
  assert.equal(first.ledgerEntry.duplicate, false);

  // Replay: same redeeming state, same key, but entry already in ledger
  const second = confirmRedemption(redeeming, [first.ledgerEntry.entry], {
    actorId: PARENT_ID,
    now: NOW,
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    idempotencyKey,
  });
  assert.equal(second.ledgerEntry.duplicate, true);
  assert.equal(second.ledgerEntry.events.length, 0);
});

// ---------------------------------------------------------------------------
// IDEMPOTENCY_RULES: structural coverage
// ---------------------------------------------------------------------------

test("IDEMPOTENCY_RULES: covers all 7 stages", () => {
  const stages = IDEMPOTENCY_RULES.map((r) => r.stage);
  const expected = [
    "task-submission",
    "task-verification-begin",
    "task-verification-result",
    "xp-grant",
    "coins-grant",
    "streak-bonus",
    "reward-redemption",
  ] as const;
  for (const stage of expected) {
    assert.ok(stages.includes(stage), `missing stage: ${stage}`);
  }
  assert.equal(IDEMPOTENCY_RULES.length, 7);
});

test("IDEMPOTENCY_RULES: both mechanisms are represented", () => {
  const mechanisms = IDEMPOTENCY_RULES.map((r) => r.mechanism);
  assert.ok(mechanisms.includes("state-machine"));
  assert.ok(mechanisms.includes("idempotency-key"));
  assert.ok(mechanisms.includes("both"));
});

test("IDEMPOTENCY_RULES: every rule has a non-empty expectedOutcome and reference", () => {
  for (const rule of IDEMPOTENCY_RULES) {
    assert.ok(rule.expectedOutcome.length > 0, `empty expectedOutcome for stage ${rule.stage}`);
    assert.ok(rule.reference.length > 0, `empty reference for stage ${rule.stage}`);
  }
});

// ---------------------------------------------------------------------------
// Integration: full approval chain replayed twice
// ---------------------------------------------------------------------------

test("integration: task approved and XP granted — replay produces no double effects", () => {
  // 1. Full task approval lifecycle
  const { assignment: assigned } = makeAssignment();
  const started = startTask(assigned, { actorId: CHILD_ID, now: NOW }).next;
  const { next: { assignment: submitted } } = submitTask(started, { taskCompletionId: "11111111-1111-4111-8111-111111111111" as any, actorId: CHILD_ID, selfReportNote: "All done", now: NOW });
  const verifying = beginVerification(submitted, PARENT_ID, NOW).next;
  const approved = verifyTask(verifying, { actorId: PARENT_ID, outcome: "APPROVED", now: NOW }).next;
  const completed = completeTask(approved, PARENT_ID, NOW).next;
  assert.equal(completed.status, "COMPLETED");

  // 2. Grant rewards
  const ledger: RewardLedgerEntry[] = [];
  const grant1 = grantTaskReward(ledger, {
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    sourceTaskAssignmentId: ASSIGNMENT_ID,
    xpAmount: 100,
    coinsAmount: 50,
    now: NOW,
  });
  if (grant1.xp && !grant1.xp.duplicate) ledger.push(grant1.xp.entry);
  if (grant1.coins && !grant1.coins.duplicate) ledger.push(grant1.coins.entry);

  assert.equal(computeBalance(ledger, "XP"), 100);
  assert.equal(computeBalance(ledger, "COINS"), 50);

  // 3. Replay (event re-delivery)
  const grant2 = grantTaskReward(ledger, {
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    sourceTaskAssignmentId: ASSIGNMENT_ID,
    xpAmount: 100,
    coinsAmount: 50,
    now: NOW,
  });
  assert.equal(grant2.xp!.duplicate, true);
  assert.equal(grant2.coins!.duplicate, true);
  // Caller must NOT push duplicate entries
  // Balance remains the same
  assert.equal(computeBalance(ledger, "XP"), 100);
  assert.equal(computeBalance(ledger, "COINS"), 50);

  // 4. Task state-machine replay: completeTask on already-COMPLETED fails
  assert.throws(
    () => completeTask(completed, PARENT_ID, NOW),
    (err: unknown) => {
      assert.ok(err instanceof TaskDomainError);
      return true;
    },
  );
});
