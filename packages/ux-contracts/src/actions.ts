/**
 * UI action -> canonical operation catalog (P1-009, extended by P1-014),
 * scoped to the nine screens in screens.ts. Source:
 * docs/ux/action-api-catalog.md's full 13-row table, narrowed to the rows
 * the Phase 1 journey needs. P1-013 added the family/child rows, which
 * were previously unrepresentable because `screen` was typed as
 * `ScreenId` and those screens have no frozen contract yet; the remaining
 * rows (friend.request, conversation.message.send, moderation.report,
 * game.session.join) are Phase 2+ social/game scope and stay out.
 *
 * The Phase 1 exit journey in docs/planning/phase-1-execution-plan.md --
 * "Parent A + Parent B -> Child -> Task Template -> Assignment -> Child
 * Today -> Attempt -> Proof -> Parent Approval -> Exactly-once Reward
 * Ledger -> Audit" -- is covered end to end by the entries below, and a
 * test asserts that rather than trusting this comment.
 *
 * `operationId` is the dot-notation engineering identifier from
 * docs/ux/action-api-catalog.md -- stable, never shown as user-facing
 * text. `openapiOperationId` is the real `operationId` in
 * services/api/openapi/openapi.yaml once one exists; `operationStatus`
 * discloses which is true right now rather than implying every action has
 * a working endpoint. P1-014 built the vertical-slice endpoints (start,
 * approve, reject, redeem) and flipped those four to IMPLEMENTED;
 * task.publish is still P1-002's to build.
 */

import type { CanonicalScreenId } from "./screen-id-registry.js";

export type OperationStatus = "SPECIFIED" | "IMPLEMENTED";

export interface ActionContract {
  /** Engineering identifier, never shown as user-facing text (docs/ux/action-api-catalog.md). */
  action: string;
  /**
   * Canonical, so an action can be attached to a screen that is named but
   * not yet contract-frozen (P-FAMILY-SETUP and friends). Before P1-013
   * this was narrowed to `ScreenId`, which is why the family/child rows of
   * docs/ux/action-api-catalog.md had no representation here at all.
   */
  screen: CanonicalScreenId;
  operationId: string;
  /** services/api/openapi/openapi.yaml's real operationId, once operationStatus is IMPLEMENTED. */
  openapiOperationId: string | null;
  resultSummary: string;
  /** Free-text next state/screen description -- not always a screen change (e.g. same-screen state transition). */
  next: string;
  operationStatus: OperationStatus;
  /** Which Phase 1 task built (or is expected to build) the real endpoint. */
  ownerTask: string;
}

export const ACTIONS: ActionContract[] = [
  {
    action: "family.create",
    screen: "P-FAMILY-SETUP",
    operationId: "family.create",
    openapiOperationId: null,
    resultSummary: "family created",
    next: "P-FAMILY-SETUP (state: family ready)",
    operationStatus: "SPECIFIED",
    ownerTask: "P1-001",
  },
  {
    action: "child.create",
    screen: "P-CHILD-PROFILE",
    operationId: "child.create",
    openapiOperationId: null,
    resultSummary: "child created",
    next: "P-CHILD-PROFILE",
    operationStatus: "SPECIFIED",
    ownerTask: "P1-001",
  },
  {
    action: "family.parent.invite",
    screen: "P-FAMILY-SETUP",
    operationId: "family.parent.invite",
    openapiOperationId: null,
    resultSummary: "invitation created",
    next: "P-FAMILY-SETUP (state: invitation sent)",
    operationStatus: "SPECIFIED",
    ownerTask: "P1-001",
  },
  {
    action: "task.publish",
    screen: "P-TASK-BUILDER",
    operationId: "task.publish",
    openapiOperationId: null,
    resultSummary: "assignment created",
    next: "P-DASH",
    operationStatus: "SPECIFIED",
    ownerTask: "P1-002",
  },
  {
    action: "task.attempt.start",
    screen: "C-TASK",
    operationId: "task.attempt.start",
    openapiOperationId: "startTaskAssignment",
    resultSummary: "attempt created (ASSIGNED -> IN_PROGRESS)",
    next: "C-TASK (state: IN_PROGRESS)",
    operationStatus: "IMPLEMENTED",
    ownerTask: "P1-014",
  },
  {
    action: "task.evidence.submit",
    screen: "C-TASK",
    operationId: "task.evidence.submit",
    openapiOperationId: "submitTaskCompletion",
    resultSummary: "evidence accepted (IN_PROGRESS -> SUBMITTED -> VERIFYING)",
    next: "C-TASK (state: VERIFYING)",
    // Already implemented by P0-009, not P1-014 -- disclosed accurately
    // rather than crediting the task that happened to touch this file.
    operationStatus: "IMPLEMENTED",
    ownerTask: "P0-009",
  },
  {
    action: "task.approval.approve",
    screen: "P-APPROVALS",
    operationId: "task.approval.approve",
    openapiOperationId: "approveTaskCompletion",
    resultSummary: "completion confirmed (VERIFYING -> APPROVED)",
    next: "P-DASH (reward processing)",
    operationStatus: "IMPLEMENTED",
    ownerTask: "P1-014",
  },
  {
    action: "task.approval.return",
    screen: "P-APPROVALS",
    operationId: "task.approval.return",
    openapiOperationId: "rejectTaskCompletion",
    resultSummary: "correction requested (VERIFYING -> REJECTED)",
    next: "P-DASH; child sees C-TASK (state: FAILED or REJECTED, see task-state.ts)",
    operationStatus: "IMPLEMENTED",
    ownerTask: "P1-014",
  },
  {
    action: "reward.redeem",
    screen: "P-REWARDS",
    operationId: "reward.redeem",
    openapiOperationId: "redeemReward",
    resultSummary: "redemption created (AVAILABLE -> REDEEMING)",
    next: "P-REWARDS (state: REDEEMING, then REDEEMED once settled)",
    operationStatus: "IMPLEMENTED",
    ownerTask: "P1-014",
  },
];
