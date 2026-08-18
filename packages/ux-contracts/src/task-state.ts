/**
 * UI task state <-> backend state mapping (P1-009).
 *
 * docs/ux/state-contracts.md specifies the UI-facing task state machine:
 *   NOT_STARTED -> IN_PROGRESS -> SUBMITTED -> VERIFYING
 *     -> APPROVED | REJECTED | FAILED -> REWARD_PENDING -> COMPLETED
 *
 * That doesn't map 1:1 onto `TaskAssignmentStatus`
 * (packages/domain-types/src/task.ts): three real gaps, each resolved here
 * rather than left for whoever builds the UI to discover mid-implementation.
 *
 * 1. NOT_STARTED has no assignment-status equivalent -- an assignment is
 *    created already `ASSIGNED`. NOT_STARTED == ASSIGNED.
 *
 * 2. FAILED is not an assignment status. The assignment transition table
 *    only allows `VERIFYING -> APPROVED | REJECTED`; there is no separate
 *    failure branch. A `REJECTED` assignment means one of two different
 *    things a child needs to see differently:
 *      - automatic verification produced `VerificationResult.outcome ===
 *        "FAILED"` (e.g. camera exercise didn't detect enough valid
 *        reps) -> show FAILED, framed as retryable.
 *      - a parent used `task.approval.return` -> show REJECTED, with the
 *        parent's comment, framed as "needs another look," not a failure.
 *    Distinguishing them needs the `VerificationResult` record, not just
 *    the assignment status -- see `deriveUiTaskState` below.
 *
 * 3. REWARD_PENDING is not an assignment status either. An `APPROVED`
 *    assignment transitions straight to `COMPLETED`
 *    (`TASK_ASSIGNMENT_TRANSITIONS.APPROVED = ["COMPLETED"]`); there's no
 *    "reward is being processed" status in between. REWARD_PENDING is a
 *    client-synthesized state: assignment is APPROVED and no
 *    `RewardLedgerEntry` referencing this completion exists yet. This is
 *    allowed under `docs/ux/state-contracts.md`'s rule ("client may
 *    animate between states") since it isn't a terminal state and isn't
 *    invented independent of domain data -- it's derived from the absence
 *    of a real ledger entry, not asserted on its own.
 */

import type { TaskAssignmentStatus, VerificationOutcome } from "@life/domain-types";

export const UI_TASK_STATES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "SUBMITTED",
  "VERIFYING",
  "APPROVED",
  "REJECTED",
  "FAILED",
  "REWARD_PENDING",
  "COMPLETED",
] as const;
export type UiTaskState = (typeof UI_TASK_STATES)[number];

export interface DeriveUiTaskStateInput {
  assignmentStatus: TaskAssignmentStatus;
  /** The most recent VerificationResult for this assignment's current attempt, if one exists. */
  latestVerificationOutcome?: VerificationOutcome;
  /** Whether the return/reject decision came from a human parent (task.approval.return) rather than automatic verification. */
  rejectedByParent?: boolean;
  /** Whether a RewardLedgerEntry already exists for this assignment's completion. */
  rewardLedgered?: boolean;
}

export function deriveUiTaskState(input: DeriveUiTaskStateInput): UiTaskState {
  switch (input.assignmentStatus) {
    case "ASSIGNED":
      return "NOT_STARTED";
    case "IN_PROGRESS":
      return "IN_PROGRESS";
    case "SUBMITTED":
      return "SUBMITTED";
    case "VERIFYING":
      return "VERIFYING";
    case "REJECTED":
      if (input.rejectedByParent) return "REJECTED";
      if (input.latestVerificationOutcome === "FAILED") return "FAILED";
      // Ambiguous inputs (neither signal present) default to REJECTED --
      // the more conservative UI framing (shows a comment field) rather
      // than silently implying an automatic failure that may not have
      // happened.
      return "REJECTED";
    case "APPROVED":
      return input.rewardLedgered ? "COMPLETED" : "REWARD_PENDING";
    case "COMPLETED":
      return "COMPLETED";
    case "ARCHIVED":
      return "COMPLETED";
  }
}
