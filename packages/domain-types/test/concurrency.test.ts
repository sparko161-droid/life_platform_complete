/**
 * Vertical slice state, idempotency and conflict fixtures (P1-015).
 *
 * Strategy per task-registry (test_strategy: "Deterministic concurrent
 * request fixtures and stale-version conflict tests."):
 *
 *   - checkVersion: stale and current versions
 *   - checkAssignmentVersion / checkFamilyVersion / checkRewardVersion
 *   - StaleVersionError: correct entity type, id, and versions reported
 *   - Race: two-approvers → first wins, second conflicts
 *   - Race: child submits while parent verifies → state-machine rejects
 *   - Race: double reward grant → idempotency-key deduplication
 *   - Network retry: re-submission of already-SUBMITTED task
 *   - CONFLICT_SCENARIOS: structural coverage — all 6 scenarios, both mechanisms
 *   - Integration: deterministic ordering of two conflicting approve operations
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChildId, FamilyId, TaskAssignmentId, TaskTemplateId } from "../src/ids.js";
import {
  CONFLICT_SCENARIOS,
  StaleVersionError,
  checkAssignmentVersion,
  checkFamilyVersion,
  checkRewardVersion,
  checkVersion,
} from "../src/concurrency.js";
import {
  grantTaskReward,
} from "../src/reward-service.js";
import type { RewardLedgerEntry } from "../src/reward.js";
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
const PARENT_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc" as const;
const PARENT_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd" as const;
const TEMPLATE_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" as TaskTemplateId;
const ASSIGNMENT_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff" as TaskAssignmentId;
const NOW = "2026-08-18T12:00:00.000Z";
const COMPLETION_ID = "11111111-1111-4111-8111-111111111111" as any;

function makeVerifyingAssignment() {
  const tpl = createTemplate({
    taskTemplateId: TEMPLATE_ID,
    familyId: FAMILY_ID,
    createdByParentId: PARENT_A,
    title: "Clean room",
    verificationStrategy: "PARENT_APPROVAL",
    rewardXp: 50,
    rewardCoins: 20,
    now: NOW,
  });
  const active = publishTemplate(tpl.next, { actorId: PARENT_A, now: NOW }).next;
  const { next: assigned } = assignTask(active, {
    taskAssignmentId: ASSIGNMENT_ID,
    assignedToChildId: CHILD_ID,
    actorId: PARENT_A,
    now: NOW,
  });
  const started = startTask(assigned, { actorId: CHILD_ID, now: NOW }).next;
  const { next: { assignment: submitted } } = submitTask(started, {
    taskCompletionId: COMPLETION_ID,
    actorId: CHILD_ID,
    selfReportNote: "Done!",
    now: NOW,
  });
  const verifying = beginVerification(submitted, PARENT_A, NOW).next;
  return { active, verifying };
}

function noEntries(): RewardLedgerEntry[] {
  return [];
}

// ---------------------------------------------------------------------------
// checkVersion
// ---------------------------------------------------------------------------

test("checkVersion: passes when submitted equals current", () => {
  assert.doesNotThrow(() => checkVersion("Entity", "id-1", 3, 3));
});

test("checkVersion: throws StaleVersionError when submitted < current", () => {
  assert.throws(
    () => checkVersion("TaskAssignment", "asgn-1", 2, 5),
    (err: unknown) => {
      assert.ok(err instanceof StaleVersionError);
      assert.equal(err.entityType, "TaskAssignment");
      assert.equal(err.entityId, "asgn-1");
      assert.equal(err.submittedVersion, 2);
      assert.equal(err.currentVersion, 5);
      return true;
    },
  );
});

test("checkVersion: throws StaleVersionError when submitted > current (future version)", () => {
  assert.throws(
    () => checkVersion("Family", "fam-1", 10, 3),
    (err: unknown) => {
      assert.ok(err instanceof StaleVersionError);
      assert.equal(err.submittedVersion, 10);
      assert.equal(err.currentVersion, 3);
      return true;
    },
  );
});

test("checkAssignmentVersion: passes when version matches", () => {
  const assignment = { taskAssignmentId: ASSIGNMENT_ID, version: 4 } as any;
  assert.doesNotThrow(() => checkAssignmentVersion(assignment, 4));
});

test("checkAssignmentVersion: throws when version is stale", () => {
  const assignment = { taskAssignmentId: ASSIGNMENT_ID, version: 4 } as any;
  assert.throws(
    () => checkAssignmentVersion(assignment, 3),
    (err: unknown) => {
      assert.ok(err instanceof StaleVersionError);
      assert.equal(err.entityType, "TaskAssignment");
      return true;
    },
  );
});

test("checkFamilyVersion: throws when version is stale", () => {
  const family = { familyId: FAMILY_ID, version: 2 } as any;
  assert.throws(
    () => checkFamilyVersion(family, 1),
    (err: unknown) => {
      assert.ok(err instanceof StaleVersionError);
      assert.equal(err.entityType, "Family");
      return true;
    },
  );
});

test("checkRewardVersion: throws when version is stale", () => {
  const reward = { rewardId: "rr-1", version: 3 } as any;
  assert.throws(
    () => checkRewardVersion(reward, 2),
    (err: unknown) => {
      assert.ok(err instanceof StaleVersionError);
      assert.equal(err.entityType, "Reward");
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// Race: two parents approve concurrently
// ---------------------------------------------------------------------------

test("race: first parent to approve wins; second sees stale version", () => {
  const { verifying } = makeVerifyingAssignment();
  // Version at VERIFYING state
  assert.equal(verifying.version, 4);

  // Parent A reads version 4, approves — succeeds
  checkAssignmentVersion(verifying, 4);
  const approved = verifyTask(verifying, { actorId: PARENT_A, outcome: "APPROVED", now: NOW }).next;
  assert.equal(approved.version, 5);

  // Parent B also read version 4, tries to approve the SAME aggregate snapshot
  // DB would return version 5 after Parent A's commit, so B's version 4 is now stale
  assert.throws(
    () => checkAssignmentVersion(approved, 4), // simulates DB returning v5 to Parent B
    (err: unknown) => {
      assert.ok(err instanceof StaleVersionError);
      assert.equal(err.submittedVersion, 4);
      assert.equal(err.currentVersion, 5);
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// Race: child submits while parent is in VERIFYING state
// ---------------------------------------------------------------------------

test("race: child tries to re-submit a task already in VERIFYING state", () => {
  const { verifying } = makeVerifyingAssignment();
  assert.equal(verifying.status, "VERIFYING");

  // Child's submit attempt on a VERIFYING assignment fails at the state machine
  assert.throws(
    () =>
      submitTask(verifying, {
        taskCompletionId: COMPLETION_ID,
        actorId: CHILD_ID,
        selfReportNote: "Retry",
        now: NOW,
      }),
    (err: unknown) => {
      assert.ok(err instanceof TaskDomainError);
      assert.ok(
        err.code.includes("STATUS") || err.message.includes("IN_PROGRESS"),
        `unexpected code: ${err.code}`,
      );
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// Race: parent approves, parent rejects — first write wins
// ---------------------------------------------------------------------------

test("race: concurrent approve and reject — first commit wins, second sees stale version", () => {
  const { verifying } = makeVerifyingAssignment();
  const v = verifying.version;

  // Parent A approves first (version v → v+1)
  checkAssignmentVersion(verifying, v);
  const approved = verifyTask(verifying, { actorId: PARENT_A, outcome: "APPROVED", now: NOW }).next;
  assert.equal(approved.version, v + 1);

  // Parent B read the same snapshot (version v), tries to reject
  // After A committed, DB returns v+1 → B's v is stale
  assert.throws(
    () => checkAssignmentVersion(approved, v),
    (err: unknown) => {
      assert.ok(err instanceof StaleVersionError);
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// Network retry: submission after timeout
// ---------------------------------------------------------------------------

test("retry: child submits, server writes, client retries — second attempt sees wrong status", () => {
  const tpl = createTemplate({
    taskTemplateId: TEMPLATE_ID,
    familyId: FAMILY_ID,
    createdByParentId: PARENT_A,
    title: "Task",
    verificationStrategy: "MANUAL_SELF",
    rewardXp: 10,
    rewardCoins: 5,
    now: NOW,
  });
  const active = publishTemplate(tpl.next, { actorId: PARENT_A, now: NOW }).next;
  const { next: assigned } = assignTask(active, {
    taskAssignmentId: ASSIGNMENT_ID,
    assignedToChildId: CHILD_ID,
    actorId: PARENT_A,
    now: NOW,
  });
  const started = startTask(assigned, { actorId: CHILD_ID, now: NOW }).next;

  // First submit succeeds
  const { next: { assignment: submitted } } = submitTask(started, {
    taskCompletionId: COMPLETION_ID,
    actorId: CHILD_ID,
    now: NOW,
  });
  assert.equal(submitted.status, "SUBMITTED");

  // Network timeout: child retries submit (server already has SUBMITTED state)
  assert.throws(
    () =>
      submitTask(submitted, {
        taskCompletionId: COMPLETION_ID,
        actorId: CHILD_ID,
        now: NOW,
      }),
    (err: unknown) => {
      assert.ok(err instanceof TaskDomainError);
      // Should be SUBMIT_TASK_WRONG_STATUS or similar
      assert.ok(
        err.code.includes("STATUS") || err.code.includes("WRONG"),
        `unexpected code: ${err.code}`,
      );
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// Double reward grant (event re-delivery)
// ---------------------------------------------------------------------------

test("double reward grant: idempotency key prevents duplicate XP entry", () => {
  const ledger: RewardLedgerEntry[] = [];

  const first = grantTaskReward(ledger, {
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    sourceTaskAssignmentId: ASSIGNMENT_ID,
    xpAmount: 50,
    coinsAmount: 20,
    now: NOW,
  });
  if (first.xp && !first.xp.duplicate) ledger.push(first.xp.entry);
  if (first.coins && !first.coins.duplicate) ledger.push(first.coins.entry);
  assert.equal(ledger.length, 2);

  // Event re-delivered
  const second = grantTaskReward(ledger, {
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    sourceTaskAssignmentId: ASSIGNMENT_ID,
    xpAmount: 50,
    coinsAmount: 20,
    now: NOW,
  });
  assert.equal(second.xp!.duplicate, true);
  assert.equal(second.coins!.duplicate, true);
  // Ledger size unchanged — caller must not push duplicates
  assert.equal(ledger.length, 2);
});

// ---------------------------------------------------------------------------
// CONFLICT_SCENARIOS: structural coverage
// ---------------------------------------------------------------------------

test("CONFLICT_SCENARIOS: covers 6 known race conditions", () => {
  assert.equal(CONFLICT_SCENARIOS.length, 6);
});

test("CONFLICT_SCENARIOS: both mechanisms are represented", () => {
  const mechanisms = CONFLICT_SCENARIOS.map((s) => s.mechanism);
  assert.ok(mechanisms.includes("optimistic-version"));
  assert.ok(mechanisms.includes("state-machine"));
  assert.ok(mechanisms.includes("idempotency-key"));
});

test("CONFLICT_SCENARIOS: every scenario has a non-empty resolution and reference", () => {
  for (const s of CONFLICT_SCENARIOS) {
    assert.ok(s.resolution.length > 0, `empty resolution for: ${s.scenario}`);
    assert.ok(s.reference.length > 0, `empty reference for: ${s.scenario}`);
  }
});

// ---------------------------------------------------------------------------
// Integration: deterministic ordering of two conflicting approvals
// ---------------------------------------------------------------------------

test("integration: full conflict — only one parent's approval creates reward effect", () => {
  const { verifying } = makeVerifyingAssignment();
  const snapshotVersion = verifying.version;

  // Simulate two parents reading the same snapshot at the same time.
  // Parent A approves first:
  checkAssignmentVersion(verifying, snapshotVersion);
  const approved = verifyTask(verifying, { actorId: PARENT_A, outcome: "APPROVED", now: NOW }).next;
  const completed = completeTask(approved, PARENT_A, NOW).next;

  // Grant rewards for completed task:
  const ledger: RewardLedgerEntry[] = [];
  const grant = grantTaskReward(ledger, {
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    sourceTaskAssignmentId: ASSIGNMENT_ID,
    xpAmount: 50,
    coinsAmount: 20,
    now: NOW,
  });
  if (grant.xp && !grant.xp.duplicate) ledger.push(grant.xp.entry);
  if (grant.coins && !grant.coins.duplicate) ledger.push(grant.coins.entry);
  assert.equal(ledger.length, 2);

  // Parent B also read snapshotVersion — after A's commit, the DB returns v+1
  // B's version check fails:
  assert.throws(
    () => checkAssignmentVersion(completed, snapshotVersion),
    (err: unknown) => {
      assert.ok(err instanceof StaleVersionError);
      assert.equal(err.submittedVersion, snapshotVersion);
      return true;
    },
  );

  // Reward grant re-delivery is also safe (idempotent):
  const grant2 = grantTaskReward(ledger, {
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    sourceTaskAssignmentId: ASSIGNMENT_ID,
    xpAmount: 50,
    coinsAmount: 20,
    now: NOW,
  });
  assert.equal(grant2.xp!.duplicate, true);
  assert.equal(grant2.coins!.duplicate, true);
  // Ledger still has exactly 2 entries
  assert.equal(ledger.length, 2);
});
