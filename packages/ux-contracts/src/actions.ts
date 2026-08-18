/**
 * UI action -> canonical operation catalog (P1-009, extended by P1-014),
 * scoped to the nine screens in screens.ts. Source:
 * docs/ux/action-api-catalog.md's full 13-row table, narrowed to the rows
 * this task's screen set actually needs -- the full table also covers
 * family/child creation and friend-request flows that have no screen
 * contract at this tier yet.
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

import type { ScreenId } from "./screens.js";

export type OperationStatus = "SPECIFIED" | "IMPLEMENTED";

export interface ActionContract {
  /** Engineering identifier, never shown as user-facing text (docs/ux/action-api-catalog.md). */
  action: string;
  screen: ScreenId;
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
