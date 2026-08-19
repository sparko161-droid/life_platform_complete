import type { Finding } from "./finding.js";

/**
 * Phase 1 adversarial assessment (P1-021).
 *
 * BLK-P1-013's acceptance criterion: "Adversarial cases cover family
 * isolation, authorization/IDOR, privilege escalation, replay, races,
 * media access, reward manipulation and information disclosure; every
 * finding has severity and retest result." test/adversarial.test.ts
 * actually runs each exploit attempt against the real domain-types
 * package (not a mock) and asserts its outcome matches what is recorded
 * here -- this file cannot silently drift from what the code really does,
 * because a regression test fails the moment it does.
 *
 * BLOCKED findings are verified controls, kept in the record because a
 * red-team assessment that only reports failures looks unfinished and
 * invites the next reviewer to re-attempt the same exploit from scratch.
 *
 * RT-002, RT-003, RT-005, RT-010 and RT-016 were originally recorded
 * ACCEPTED_RISK: the pure domain layer (no I/O, no persisted
 * Family/session available to check against by design -- see
 * docs/product/actors-and-permissions.md) defers actor authorization and
 * version enforcement to an application/API layer that did not exist yet.
 * P1-025 (services/api/src/repositories/) built that layer and closed all
 * five -- each is now BLOCKED, retested against the real repository layer
 * (services/api/test/repositories.test.ts) running against a real
 * Postgres in CI, not the bare domain function. See
 * tasks/registry.yaml's DISC-P1-021-1/DISC-P1-021-2 for the discovery
 * trail and tasks/phase-1-blockers.yaml's BLK-P1-013 note for the
 * blocker this closes.
 */
export const FINDINGS: readonly Finding[] = [
  {
    id: "RT-001",
    category: "FAMILY_ISOLATION",
    severity: "INFO",
    title: "Cross-family media evidence access is rejected",
    exploitAttempt: "authorizeEvidenceAccess() called with a requestingFamilyId that does not own the evidence.",
    actualOutcome: "Throws MediaDomainError(FAMILY_ISOLATION_VIOLATION); no evidence data is returned.",
    status: "BLOCKED",
    retestResult: "PASS",
    reference: "test/adversarial.test.ts: 'FAMILY_ISOLATION: cross-family evidence access is rejected'",
  },
  {
    id: "RT-002",
    category: "AUTHORIZATION_IDOR",
    severity: "INFO",
    title: "verifyTask does not check the approving actor is a family member",
    exploitAttempt: "verifyTask() called with an actorId that belongs to no membership of the assignment's family at all (an arbitrary string).",
    actualOutcome: "The pure domain function still succeeds in isolation (unchanged, disclosed design) -- but P1-025's repository layer (services/api/src/repositories/task-repository.ts) now calls requireActiveParentMemberOrSystem before ever reaching it, and rejects the exploit with RepositoryAuthorizationError(NOT_ACTIVE_FAMILY_MEMBER). Retested against the real repository layer, not the bare domain function.",
    status: "BLOCKED",
    retestResult: "PASS",
    reference: "services/api/test/repositories.test.ts: 'RT-002 retest: verifyTask rejects an actor with no family membership'",
  },
  {
    id: "RT-003",
    category: "PRIVILEGE_ESCALATION",
    severity: "INFO",
    title: "A child can self-approve their own submitted task",
    exploitAttempt: "verifyTask() called with outcome APPROVED and actorId set to the same child who submitted the task being approved.",
    actualOutcome: "The pure domain function still succeeds in isolation (unchanged, disclosed design) -- but P1-025's repository layer's requireActiveParentMemberOrSystem check queries parent_memberships, and a child's id is never a row there, so self-approval is rejected with RepositoryAuthorizationError(NOT_ACTIVE_FAMILY_MEMBER) the same way an unrelated outsider is (RT-002) -- no separate role check was even needed.",
    status: "BLOCKED",
    retestResult: "PASS",
    reference: "services/api/test/repositories.test.ts: 'RT-003 retest: verifyTask rejects the submitting child self-approving'",
  },
  {
    id: "RT-004",
    category: "PRIVILEGE_ESCALATION",
    severity: "INFO",
    title: "A non-owner parent cannot revoke another parent's membership",
    exploitAttempt: "revokeParent() called by a parent membership without isFamilyOwner and without an override capability.",
    actualOutcome: "Throws FamilyDomainError(REVOKE_PARENT_NOT_OWNER) (requireCapability checks the real ParentMembership record).",
    status: "BLOCKED",
    retestResult: "PASS",
    reference: "test/adversarial.test.ts: 'PRIVILEGE_ESCALATION: a non-owner parent cannot revoke another parent'",
  },
  {
    id: "RT-005",
    category: "REWARD_MANIPULATION",
    severity: "INFO",
    title: "confirmRedemption does not check the confirming actor is a family member",
    exploitAttempt: "confirmRedemption() called with an arbitrary actorId unrelated to the reward's family.",
    actualOutcome: "The pure domain function still succeeds in isolation (unchanged, disclosed design) -- but P1-025's repository layer (services/api/src/repositories/reward-repository.ts) now calls requireActiveParentMemberOrSystem before ever reaching it, and rejects the exploit with RepositoryAuthorizationError(NOT_ACTIVE_FAMILY_MEMBER). Retested against the real repository layer.",
    status: "BLOCKED",
    retestResult: "PASS",
    reference: "services/api/test/repositories.test.ts: 'RT-005 retest: confirmRedemption rejects an actor with no family membership'",
  },
  {
    id: "RT-006",
    category: "REWARD_MANIPULATION",
    severity: "INFO",
    title: "Negative-amount reward grants are rejected",
    exploitAttempt: "grantTaskReward() called with a negative xpAmount.",
    actualOutcome: "Throws RewardDomainError before any ledger entry is constructed.",
    status: "BLOCKED",
    retestResult: "PASS",
    reference: "test/adversarial.test.ts: 'REWARD_MANIPULATION: a negative-amount reward grant is rejected'",
  },
  {
    id: "RT-007",
    category: "REWARD_MANIPULATION",
    severity: "INFO",
    title: "A reward grant cannot be doubled by replaying its source event",
    exploitAttempt: "grantTaskReward() called twice with the same sourceTaskAssignmentId (simulating an at-least-once event redelivery).",
    actualOutcome: "Second call returns duplicate:true and posts no new ledger entry; computeBalance is unchanged.",
    status: "BLOCKED",
    retestResult: "PASS",
    reference: "test/adversarial.test.ts: 'REWARD_MANIPULATION: replaying a reward grant does not double the balance'",
  },
  {
    id: "RT-008",
    category: "REPLAY",
    severity: "INFO",
    title: "An already-SUBMITTED task cannot be re-submitted",
    exploitAttempt: "submitTask() called a second time on an assignment already in SUBMITTED status.",
    actualOutcome: "Throws TaskDomainError(SUBMIT_TASK_WRONG_STATUS); no second TaskCompletion record is created.",
    status: "BLOCKED",
    retestResult: "PASS",
    reference: "test/adversarial.test.ts: 'REPLAY: re-submitting an already-SUBMITTED task is rejected'",
  },
  {
    id: "RT-009",
    category: "REPLAY",
    severity: "INFO",
    title: "A redemption cannot be confirmed twice for double reward effect",
    exploitAttempt: "confirmRedemption() called twice with the same idempotencyKey against the same REDEEMING reward.",
    actualOutcome: "Second call's ledger write returns duplicate:true with no new events; only the first call's ledger entry exists.",
    status: "BLOCKED",
    retestResult: "PASS",
    reference: "test/adversarial.test.ts: 'REPLAY: confirming a redemption twice does not double-post the ledger'",
  },
  {
    id: "RT-010",
    category: "RACE_CONDITION",
    severity: "INFO",
    title: "Optimistic-version checking is now an enforced control, not only a mechanism",
    exploitAttempt: "Two parents read the same assignment snapshot and both attempt to approve it; checkAssignmentVersion is available to detect this, but a caller could previously skip invoking it.",
    actualOutcome: "P1-025's repository layer takes SELECT ... FOR UPDATE (a real row lock) on every read, then writes via UPDATE ... WHERE version = $n inside one transaction (services/api/src/db/pool.ts's withTransaction) -- a losing writer now gets RepositoryConflictError against the real database, not just from calling checkVersion voluntarily. Retested against a real Postgres.",
    status: "BLOCKED",
    retestResult: "PASS",
    reference: "services/api/test/repositories.test.ts: 'RT-010 retest: a concurrent stale-version write is rejected with RepositoryConflictError'",
  },
  {
    id: "RT-011",
    category: "RACE_CONDITION",
    severity: "INFO",
    title: "beginVerification cannot be entered twice for the same submission",
    exploitAttempt: "beginVerification() called a second time on an assignment already in VERIFYING status (simulating two concurrent verifiers).",
    actualOutcome: "Throws TaskDomainError(BEGIN_VERIFICATION_INVALID_TRANSITION).",
    status: "BLOCKED",
    retestResult: "PASS",
    reference: "test/adversarial.test.ts: 'RACE_CONDITION: beginVerification rejects a second concurrent entry'",
  },
  {
    id: "RT-012",
    category: "MEDIA_ACCESS",
    severity: "INFO",
    title: "Oversized media uploads are rejected before evidence is registered",
    exploitAttempt: "registerEvidence() called with a PHOTO sizeBytes above UPLOAD_MAX_BYTES.PHOTO.",
    actualOutcome: "Throws MediaDomainError(FILE_TOO_LARGE); no MediaEvidence record is created.",
    status: "BLOCKED",
    retestResult: "PASS",
    reference: "test/adversarial.test.ts: 'MEDIA_ACCESS: an oversized upload is rejected'",
  },
  {
    id: "RT-013",
    category: "MEDIA_ACCESS",
    severity: "INFO",
    title: "Disallowed content types are rejected before evidence is registered",
    exploitAttempt: "registerEvidence() called with contentType 'application/x-msdownload' for a PHOTO upload.",
    actualOutcome: "Throws MediaDomainError(CONTENT_TYPE_NOT_PERMITTED).",
    status: "BLOCKED",
    retestResult: "PASS",
    reference: "test/adversarial.test.ts: 'MEDIA_ACCESS: a disallowed content type is rejected'",
  },
  {
    id: "RT-014",
    category: "INFORMATION_DISCLOSURE",
    severity: "INFO",
    title: "MediaEvidence never carries a public URL, only an opaque storage key",
    exploitAttempt: "Inspect MediaEvidenceSchema's shape for any field that could resolve to a publicly reachable URL.",
    actualOutcome: "Only storageKey (opaque) is present; no url/publicUrl/downloadLink field exists on the schema.",
    status: "BLOCKED",
    retestResult: "PASS",
    reference: "test/adversarial.test.ts: 'INFORMATION_DISCLOSURE: MediaEvidenceSchema has no public-URL field'",
  },
  {
    id: "RT-015",
    category: "INFORMATION_DISCLOSURE",
    severity: "INFO",
    title: "TASK_SUBMITTED's event payload does not leak the child's raw submission note",
    exploitAttempt: "submitTask() called with a selfReportNote, then inspect the emitted TASK_SUBMITTED event's payload.",
    actualOutcome: "Payload contains only taskAssignmentId and taskCompletionId -- selfReportNote is not present, matching docs/architecture/events.md's PII rule ('minimal payload; sensitive content should be fetched through authorized services when necessary').",
    status: "BLOCKED",
    retestResult: "PASS",
    reference: "test/adversarial.test.ts: 'INFORMATION_DISCLOSURE: TASK_SUBMITTED payload excludes the raw submission note'",
  },
  {
    id: "RT-016",
    category: "AUTHORIZATION_IDOR",
    severity: "INFO",
    title: "assignTask does not check the assigned child belongs to the template's family",
    exploitAttempt: "assignTask() called with an assignedToChildId from a different family than the template.",
    actualOutcome: "The pure domain function still succeeds in isolation (unchanged, disclosed design) -- but P1-025's repository layer now calls requireChildInFamily before ever reaching it, and rejects the exploit with RepositoryAuthorizationError(CHILD_NOT_IN_FAMILY). Retested against the real repository layer.",
    status: "BLOCKED",
    retestResult: "PASS",
    reference: "services/api/test/repositories.test.ts: 'RT-016 retest: assignTask rejects a child from a different family'",
  },
] as const;
