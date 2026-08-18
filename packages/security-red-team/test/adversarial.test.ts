/**
 * Adversarial exploit fixtures (P1-021).
 *
 * Every FINDINGS entry (src/findings.ts) is backed by a test here that
 * actually attempts the exploit against real @life/domain-types code --
 * not a mock, not a description. A test asserting BLOCKED fails the
 * moment a future change removes the control it verifies; a test
 * asserting ACCEPTED_RISK fails the moment someone closes that gap
 * without updating the finding (assertThrows would start failing because
 * the "exploit" would no longer succeed, which is the point).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FamilyDomainError,
  MediaDomainError,
  MediaEvidenceSchema,
  RewardDomainError,
  StaleVersionError,
  TaskDomainError,
  assignTask,
  authorizeEvidenceAccess,
  beginVerification,
  checkAssignmentVersion,
  computeBalance,
  confirmRedemption,
  createFamily,
  createReward,
  createTemplate,
  activateReward,
  grantTaskReward,
  initiateRedemption,
  publishTemplate,
  registerEvidence,
  revokeParent,
  startTask,
  submitTask,
  verifyTask,
} from "@life/domain-types";
import type { RewardLedgerEntry } from "@life/domain-types";
import { FINDING_CATEGORIES, FINDINGS, FindingSchema, validateFinding } from "../src/index.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FAMILY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FAMILY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CHILD_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CHILD_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PARENT_A = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const OUTSIDER = "ffffffff-ffff-4fff-8fff-ffffffffffff"; // belongs to no family/membership at all
const TEMPLATE_ID = "11111111-1111-4111-8111-111111111111";
const ASSIGNMENT_ID = "22222222-2222-4222-8222-222222222222";
const REWARD_ID = "33333333-3333-4333-8333-333333333333";
const COMPLETION_ID = "44444444-4444-4444-8444-444444444444";
const EVIDENCE_ID = "55555555-5555-4555-8555-555555555555";
const NOW = "2026-08-19T00:00:00.000Z";

function makeVerifyingAssignment() {
  const tpl = createTemplate({
    taskTemplateId: TEMPLATE_ID as any,
    familyId: FAMILY_A as any,
    createdByParentId: PARENT_A as any,
    title: "Clean room",
    verificationStrategy: "PARENT_APPROVAL",
    rewardXp: 50,
    rewardCoins: 20,
    now: NOW,
  });
  const active = publishTemplate(tpl.next, { actorId: PARENT_A as any, now: NOW }).next;
  const { next: assigned } = assignTask(active, {
    taskAssignmentId: ASSIGNMENT_ID as any,
    assignedToChildId: CHILD_A as any,
    actorId: PARENT_A as any,
    now: NOW,
  });
  const started = startTask(assigned, { actorId: CHILD_A as any, now: NOW }).next;
  const { next: submitted } = submitTask(started, {
    taskCompletionId: COMPLETION_ID as any,
    actorId: CHILD_A as any,
    selfReportNote: "Confidential note: I hid the mess under the bed.",
    now: NOW,
  });
  const verifying = beginVerification(submitted.assignment, PARENT_A, NOW).next;
  return { active, verifying, submittedAssignment: submitted.assignment };
}

function makeRedeemingReward() {
  const { next: locked } = createReward({
    rewardId: REWARD_ID as any,
    familyId: FAMILY_A as any,
    createdByParentId: PARENT_A as any,
    title: "Movie night",
    type: "ACTIVITY",
    now: NOW,
  });
  const { next: available } = activateReward(locked, PARENT_A as any, NOW);
  const { next: redeeming } = initiateRedemption(available, { familyId: FAMILY_A as any, childId: CHILD_A as any, now: NOW });
  return redeeming;
}

// ---------------------------------------------------------------------------
// RT-001: FAMILY_ISOLATION
// ---------------------------------------------------------------------------

test("FAMILY_ISOLATION: cross-family evidence access is rejected", () => {
  const evidence = registerEvidence(
    { familyId: FAMILY_A as any, children: [{ childId: CHILD_A as any }] } as any,
    {
      familyId: FAMILY_A as any,
      mediaEvidenceId: EVIDENCE_ID as any,
      childId: CHILD_A as any,
      kind: "PHOTO",
      contentType: "image/jpeg",
      sizeBytes: 1024,
      storageKey: "families/a/evidence/1",
      now: NOW,
    },
  );
  assert.throws(
    () => authorizeEvidenceAccess({ evidence, requestingFamilyId: FAMILY_B as any }),
    MediaDomainError,
  );
});

// ---------------------------------------------------------------------------
// RT-002 / RT-016: AUTHORIZATION_IDOR
// ---------------------------------------------------------------------------

test("AUTHORIZATION_IDOR: verifyTask accepts an actor with no family membership", () => {
  const { verifying } = makeVerifyingAssignment();
  // OUTSIDER is not a member of FAMILY_A at all -- no Family aggregate is
  // even consulted by verifyTask to find that out.
  const result = verifyTask(verifying, { actorId: OUTSIDER, outcome: "APPROVED", now: NOW });
  assert.equal(result.next.status, "APPROVED");
});

test("AUTHORIZATION_IDOR: assignTask accepts a child from a different family", () => {
  const tpl = createTemplate({
    taskTemplateId: TEMPLATE_ID as any,
    familyId: FAMILY_A as any,
    createdByParentId: PARENT_A as any,
    title: "Clean room",
    verificationStrategy: "PARENT_APPROVAL",
    rewardXp: 10,
    rewardCoins: 5,
    now: NOW,
  });
  const active = publishTemplate(tpl.next, { actorId: PARENT_A as any, now: NOW }).next;
  // CHILD_B is docstring-disclosed as belonging to a different family than
  // the FAMILY_A template -- assignTask has no Family aggregate to check.
  const { next } = assignTask(active, {
    taskAssignmentId: ASSIGNMENT_ID as any,
    assignedToChildId: CHILD_B as any,
    actorId: PARENT_A as any,
    now: NOW,
  });
  assert.equal(next.assignedToChildId, CHILD_B);
});

// ---------------------------------------------------------------------------
// RT-003 / RT-004: PRIVILEGE_ESCALATION
// ---------------------------------------------------------------------------

test("PRIVILEGE_ESCALATION: a child can self-approve their own submitted task", () => {
  const { verifying } = makeVerifyingAssignment();
  // CHILD_A is the same child who submitted this task -- verifyTask has no
  // role check to reject them approving their own work.
  const result = verifyTask(verifying, { actorId: CHILD_A, outcome: "APPROVED", now: NOW });
  assert.equal(result.next.status, "APPROVED");
});

test("PRIVILEGE_ESCALATION: a non-owner parent cannot revoke another parent", () => {
  const { next: family } = createFamily({ familyId: FAMILY_A as any, ownerId: PARENT_A as any, now: NOW });
  // A second, non-owner membership with no override capability.
  const nonOwner = {
    ...family,
    parents: [
      ...family.parents,
      {
        parentId: OUTSIDER as any,
        familyId: FAMILY_A as any,
        status: "ACTIVE" as const,
        isFamilyOwner: false,
        capabilities: [],
        invitedAt: NOW,
        activatedAt: NOW,
      },
    ],
  };
  assert.throws(
    () => revokeParent(nonOwner as any, { targetId: PARENT_A as any, actorId: OUTSIDER as any, now: NOW }),
    FamilyDomainError,
  );
});

// ---------------------------------------------------------------------------
// RT-005 / RT-006 / RT-007: REWARD_MANIPULATION
// ---------------------------------------------------------------------------

test("REWARD_MANIPULATION: confirmRedemption accepts an actor with no family membership", () => {
  const redeeming = makeRedeemingReward();
  const result = confirmRedemption(redeeming, [], {
    actorId: OUTSIDER as any,
    now: NOW,
    familyId: FAMILY_A as any,
    childId: CHILD_A as any,
    idempotencyKey: "reward-redemption:test:1",
  });
  assert.equal(result.next.status, "REDEEMED");
});

test("REWARD_MANIPULATION: a negative-amount reward grant is rejected", () => {
  assert.throws(
    () =>
      grantTaskReward([], {
        familyId: FAMILY_A as any,
        childId: CHILD_A as any,
        sourceTaskAssignmentId: ASSIGNMENT_ID as any,
        xpAmount: -50,
        coinsAmount: 0,
        now: NOW,
      }),
    RewardDomainError,
  );
});

test("REWARD_MANIPULATION: replaying a reward grant does not double the balance", () => {
  const ledger: RewardLedgerEntry[] = [];
  const first = grantTaskReward(ledger, {
    familyId: FAMILY_A as any,
    childId: CHILD_A as any,
    sourceTaskAssignmentId: ASSIGNMENT_ID as any,
    xpAmount: 50,
    coinsAmount: 0,
    now: NOW,
  });
  if (first.xp && !first.xp.duplicate) ledger.push(first.xp.entry);
  assert.equal(computeBalance(ledger, "XP"), 50);

  const second = grantTaskReward(ledger, {
    familyId: FAMILY_A as any,
    childId: CHILD_A as any,
    sourceTaskAssignmentId: ASSIGNMENT_ID as any,
    xpAmount: 50,
    coinsAmount: 0,
    now: NOW,
  });
  assert.equal(second.xp!.duplicate, true);
  assert.equal(computeBalance(ledger, "XP"), 50);
});

// ---------------------------------------------------------------------------
// RT-008 / RT-009: REPLAY
// ---------------------------------------------------------------------------

test("REPLAY: re-submitting an already-SUBMITTED task is rejected", () => {
  const { submittedAssignment } = makeVerifyingAssignment();
  // Re-attempt submission on the SUBMITTED assignment (before it moved to VERIFYING).
  assert.throws(
    () =>
      submitTask(submittedAssignment, {
        taskCompletionId: "66666666-6666-4666-8666-666666666666" as any,
        actorId: CHILD_A as any,
        now: NOW,
      }),
    TaskDomainError,
  );
});

test("REPLAY: confirming a redemption twice does not double-post the ledger", () => {
  const redeeming = makeRedeemingReward();
  const key = "reward-redemption:replay-test:1";
  const first = confirmRedemption(redeeming, [], {
    actorId: PARENT_A as any,
    now: NOW,
    familyId: FAMILY_A as any,
    childId: CHILD_A as any,
    idempotencyKey: key,
  });
  const second = confirmRedemption(redeeming, [first.ledgerEntry.entry], {
    actorId: PARENT_A as any,
    now: NOW,
    familyId: FAMILY_A as any,
    childId: CHILD_A as any,
    idempotencyKey: key,
  });
  assert.equal(second.ledgerEntry.duplicate, true);
  assert.equal(second.ledgerEntry.events.length, 0);
});

// ---------------------------------------------------------------------------
// RT-010 / RT-011: RACE_CONDITION
// ---------------------------------------------------------------------------

test("RACE_CONDITION: version check is available but not self-enforcing", () => {
  const { verifying } = makeVerifyingAssignment();
  // The mechanism correctly detects staleness when a caller uses it...
  const approved = verifyTask(verifying, { actorId: PARENT_A, outcome: "APPROVED", now: NOW }).next;
  assert.throws(() => checkAssignmentVersion(approved, verifying.version), StaleVersionError);
  // ...but verifyTask itself never calls checkAssignmentVersion, so a second
  // caller that skips the check (exactly what happens without a DB
  // transaction/unique-version constraint) succeeds anyway:
  const secondApprover = verifyTask(verifying, { actorId: "second-parent", outcome: "REJECTED", now: NOW });
  assert.equal(secondApprover.next.status, "REJECTED");
});

test("RACE_CONDITION: beginVerification rejects a second concurrent entry", () => {
  const { verifying } = makeVerifyingAssignment();
  assert.throws(() => beginVerification(verifying, PARENT_A, NOW), TaskDomainError);
});

// ---------------------------------------------------------------------------
// RT-012 / RT-013: MEDIA_ACCESS
// ---------------------------------------------------------------------------

test("MEDIA_ACCESS: an oversized upload is rejected", () => {
  assert.throws(
    () =>
      registerEvidence(
        { familyId: FAMILY_A as any, children: [{ childId: CHILD_A as any }] } as any,
        {
          familyId: FAMILY_A as any,
          mediaEvidenceId: EVIDENCE_ID as any,
          childId: CHILD_A as any,
          kind: "PHOTO",
          contentType: "image/jpeg",
          sizeBytes: 50 * 1024 * 1024, // 50 MB, over the 10 MB PHOTO limit
          storageKey: "families/a/evidence/2",
          now: NOW,
        },
      ),
    MediaDomainError,
  );
});

test("MEDIA_ACCESS: a disallowed content type is rejected", () => {
  assert.throws(
    () =>
      registerEvidence(
        { familyId: FAMILY_A as any, children: [{ childId: CHILD_A as any }] } as any,
        {
          familyId: FAMILY_A as any,
          mediaEvidenceId: EVIDENCE_ID as any,
          childId: CHILD_A as any,
          kind: "PHOTO",
          contentType: "application/x-msdownload",
          sizeBytes: 1024,
          storageKey: "families/a/evidence/3",
          now: NOW,
        },
      ),
    MediaDomainError,
  );
});

// ---------------------------------------------------------------------------
// RT-014 / RT-015: INFORMATION_DISCLOSURE
// ---------------------------------------------------------------------------

test("INFORMATION_DISCLOSURE: MediaEvidenceSchema has no public-URL field", () => {
  const shape = Object.keys(MediaEvidenceSchema.shape);
  for (const key of shape) {
    assert.doesNotMatch(key.toLowerCase(), /url|link/u, `unexpected public-URL-shaped field: ${key}`);
  }
});

test("INFORMATION_DISCLOSURE: TASK_SUBMITTED payload excludes the raw submission note", () => {
  const tpl = createTemplate({
    taskTemplateId: "77777777-7777-4777-8777-777777777777" as any,
    familyId: FAMILY_A as any,
    createdByParentId: PARENT_A as any,
    title: "T",
    verificationStrategy: "MANUAL_SELF",
    rewardXp: 1,
    rewardCoins: 1,
    now: NOW,
  });
  const active = publishTemplate(tpl.next, { actorId: PARENT_A as any, now: NOW }).next;
  const { next: assigned } = assignTask(active, {
    taskAssignmentId: "88888888-8888-4888-8888-888888888888" as any,
    assignedToChildId: CHILD_A as any,
    actorId: PARENT_A as any,
    now: NOW,
  });
  const started = startTask(assigned, { actorId: CHILD_A as any, now: NOW }).next;
  const { events } = submitTask(started, {
    taskCompletionId: "99999999-9999-4999-8999-999999999999" as any,
    actorId: CHILD_A as any,
    selfReportNote: "Confidential note: hid the mess under the bed.",
    now: NOW,
  });
  const submittedPayload = events.find((e) => e.eventType === "TASK_SUBMITTED")!.payload;
  assert.equal(JSON.stringify(submittedPayload).includes("Confidential"), false);
});

// ---------------------------------------------------------------------------
// Registry structural coverage
// ---------------------------------------------------------------------------

test("FINDINGS: every entry parses against FindingSchema", () => {
  for (const finding of FINDINGS) {
    const result = FindingSchema.safeParse(finding);
    assert.ok(result.success, `${finding.id}: ${JSON.stringify(validateFinding(finding))}`);
  }
});

test("FINDINGS: every acceptance-criteria category has at least one finding", () => {
  const covered = new Set(FINDINGS.map((f) => f.category));
  for (const category of FINDING_CATEGORIES) {
    assert.ok(covered.has(category), `no finding covers category ${category}`);
  }
});

test("FINDINGS: ids are unique", () => {
  const ids = FINDINGS.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("FINDINGS: every non-BLOCKED finding names a remediation and an owner", () => {
  for (const f of FINDINGS) {
    if (f.status === "BLOCKED") continue;
    assert.ok(f.remediation, `${f.id}: missing remediation`);
    assert.ok(f.remediationOwner, `${f.id}: missing remediationOwner`);
  }
});
