import type { ChildId, FamilyId, TaskAssignmentId } from "./ids.js";
import type { RewardLedgerEntry } from "./reward.js";
import type { RewardLedgerKind } from "./reward.js";

/**
 * Completion/verification/reward idempotency rules (P1-008).
 *
 * This module codifies the idempotency contract across the task–verification–
 * reward pipeline. The rules here are the *machine-checkable* expression of
 * docs/architecture/concurrency-and-conflicts.md:
 *
 *   "Two parents approve one completion: only one canonical approval effect."
 *   "Reward deleted while child redeems: redemption is accepted or rejected
 *    atomically by current reward state."
 *
 * === Idempotency model ===
 *
 * The domain layer uses two complementary mechanisms:
 *
 * 1. **State-machine gates** (task-service.ts, reward-service.ts)
 *    Duplicate requests that re-enter a state the aggregate is already past
 *    are rejected by `isValidTask[Template|Assignment]Transition` /
 *    `isValidRewardTransition`. The caller receives a DomainError and can
 *    detect the duplicate by catching and re-reading the current state.
 *
 * 2. **idempotencyKey** (reward-service.ts → ledger entries)
 *    Write-once ledger entries are identified by a deterministic key derived
 *    from the source event. A duplicate write with the same key is silently
 *    ignored: `grantTaskReward` / `grantStreakBonus` / `adjustBalance` return
 *    `duplicate: true` when the key already exists in the entry set.
 *
 * === Key derivation ===
 *
 * Keys are deterministic strings combining source entity IDs so that the same
 * real-world event always produces the same key, regardless of how many times
 * the application retries. Key format is intentionally human-readable so that
 * support tooling can trace a ledger entry back to its source event.
 *
 * === What the caller must do ===
 *
 * The application layer (HTTP handler / event consumer) is responsible for:
 *  1. Loading current aggregate state from the DB.
 *  2. Calling the domain service function.
 *  3. If the function returns `duplicate: true`, returning the existing result
 *     to the caller without writing again.
 *  4. If the function throws `INVALID_*_TRANSITION`, re-reading the current
 *     state and returning it as the authoritative result.
 *  5. Using a DB transaction for (state check + write) so concurrent requests
 *     do not both pass the check before either writes.
 *
 * Sources:
 *   - docs/architecture/concurrency-and-conflicts.md
 *   - docs/architecture/api-contracts.md ("idempotency keys for money writes")
 *   - packages/domain-types/src/reward-service.ts
 *   - packages/domain-types/src/task-service.ts
 */

// ---------------------------------------------------------------------------
// Idempotency key builders
// ---------------------------------------------------------------------------

/**
 * Builds the deterministic idempotency key for an XP or COINS ledger entry
 * that is posted when a task assignment is approved (TASK_COMPLETION reason).
 *
 * The key encodes: the source event type, the assignment ID, and the currency,
 * so that the same approval event cannot create two XP or two COINS entries.
 */
export function taskCompletionRewardKey(
  sourceTaskAssignmentId: TaskAssignmentId,
  kind: RewardLedgerKind,
): string {
  return `task-completion:${sourceTaskAssignmentId}:${kind}`;
}

/**
 * Builds the deterministic idempotency key for a STREAK_BONUS ledger entry
 * posted when a child completes an N-day streak.
 *
 * `streakDays`: the streak length (e.g. 7, 14, 30) that triggered the bonus.
 * `periodStart`: ISO 8601 date string for the period the streak was achieved in
 *                (e.g. "2026-08-18"). Prevents multiple bonuses for the same
 *                streak window on re-runs/retries.
 */
export function streakBonusKey(
  childId: ChildId,
  streakDays: number,
  periodStart: string,
  kind: RewardLedgerKind,
): string {
  return `streak-bonus:${childId}:${streakDays}d:${periodStart}:${kind}`;
}

/**
 * Builds the deterministic idempotency key for a REWARD_REDEMPTION ledger entry
 * posted when a parent confirms a child's reward redemption.
 *
 * The key encodes: the reward ID and the redemption attempt ID (supplied by
 * the initiating request to distinguish multiple redemption attempts for a
 * non-one-use reward).
 */
export function rewardRedemptionKey(
  rewardId: string,
  attemptId: string,
): string {
  return `reward-redemption:${rewardId}:${attemptId}`;
}

/**
 * Builds the deterministic idempotency key for a PARENT_ADJUSTMENT ledger entry.
 * The key encodes: the parent's ID and a caller-supplied reference that makes
 * the adjustment unique (e.g. "admin-correction-2026-08", a ticket ID, or a
 * UUID generated at the time the parent submits the adjustment form).
 */
export function parentAdjustmentKey(
  parentId: string,
  adjustmentRef: string,
  kind: RewardLedgerKind,
): string {
  return `parent-adjustment:${parentId}:${adjustmentRef}:${kind}`;
}

// ---------------------------------------------------------------------------
// Duplicate-detection helpers
// ---------------------------------------------------------------------------

/**
 * Given a set of ledger entries for a child, returns true if an entry with
 * the exact idempotency key already exists. The application layer calls this
 * before writing to detect replays.
 */
export function isRewardLedgerDuplicate(
  existingEntries: readonly RewardLedgerEntry[],
  idempotencyKey: string,
): boolean {
  return existingEntries.some((e) => e.idempotencyKey === idempotencyKey);
}

// ---------------------------------------------------------------------------
// Idempotency rules (structured for machine validation)
// ---------------------------------------------------------------------------

/**
 * Describes the expected behaviour when a duplicate request arrives at each
 * stage of the task–verification–reward pipeline.
 *
 * This object is exported as the canonical source of truth for the idempotency
 * contract. Tests import it and assert that each rule's `expectedOutcome` is
 * what the domain service actually produces.
 */
export const IDEMPOTENCY_RULES = [
  {
    stage: "task-submission",
    scenario: "Child re-submits an already-SUBMITTED task",
    mechanism: "state-machine",
    expectedOutcome: "INVALID_TRANSITION — task is not IN_PROGRESS; caller re-reads SUBMITTED state",
    reference: "task-service.ts: submitTask requires status === IN_PROGRESS",
  },
  {
    stage: "task-verification-begin",
    scenario: "Two verifiers call beginVerification concurrently",
    mechanism: "state-machine",
    expectedOutcome: "Second call fails INVALID_TRANSITION (already VERIFYING); first write wins via optimistic lock",
    reference: "task-service.ts: beginVerification requires status === SUBMITTED",
  },
  {
    stage: "task-verification-result",
    scenario: "Parent approves an already-APPROVED task",
    mechanism: "state-machine",
    expectedOutcome: "INVALID_TRANSITION — task is not VERIFYING; caller re-reads APPROVED state",
    reference: "task-service.ts: verifyTask requires status === VERIFYING",
  },
  {
    stage: "xp-grant",
    scenario: "XP_GRANTED event replayed for an already-granted assignment",
    mechanism: "idempotency-key",
    expectedOutcome: "grantTaskReward returns duplicate:true; no new ledger entry written",
    reference: "reward-service.ts: taskCompletionRewardKey prevents double-grant",
  },
  {
    stage: "coins-grant",
    scenario: "COINS_GRANTED event replayed for an already-granted assignment",
    mechanism: "idempotency-key",
    expectedOutcome: "grantTaskReward returns duplicate:true; no new ledger entry written",
    reference: "reward-service.ts: taskCompletionRewardKey prevents double-grant",
  },
  {
    stage: "streak-bonus",
    scenario: "Streak-bonus consumer retries after a transient failure",
    mechanism: "idempotency-key",
    expectedOutcome: "grantStreakBonus returns duplicate:true; no second STREAK_BONUS entry",
    reference: "reward-service.ts: streakBonusKey encodes childId+streakDays+periodStart+kind",
  },
  {
    stage: "reward-redemption",
    scenario: "confirmRedemption called twice for the same redemption",
    mechanism: "both",
    expectedOutcome: "Second state-machine call fails INVALID_REWARD_STATUS (already REDEEMED); ledger duplicate:true on replay",
    reference: "reward-service.ts: confirmRedemption requires REDEEMING; idempotency key prevents double entry",
  },
] as const;

export type IdempotencyRule = (typeof IDEMPOTENCY_RULES)[number];
export type IdempotencyStage = IdempotencyRule["stage"];
export type IdempotencyMechanism = IdempotencyRule["mechanism"];
