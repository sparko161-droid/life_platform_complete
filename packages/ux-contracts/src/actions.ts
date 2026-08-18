/**
 * UI action -> canonical operation catalog (P1-009), scoped to the nine
 * screens in screens.ts. Source: docs/ux/action-api-catalog.md's full
 * 13-row table, narrowed to the rows this task's screen set actually
 * needs -- the full table also covers family/child creation and
 * friend-request flows that have no screen contract at this tier yet.
 *
 * `operationId` names match `docs/ux/action-api-catalog.md`'s engineering
 * identifiers. None of them exist as real `services/api/openapi/openapi.yaml`
 * paths yet -- P0-009 froze the request/response *schemas*
 * (TaskAssignment, VerificationResult, RewardLedgerEntry, ...) but not
 * these operations. `operationStatus: "SPECIFIED"` discloses that
 * explicitly rather than implying an endpoint exists. The owning task
 * builds the real endpoint and should update this to "IMPLEMENTED" plus a
 * link to the OpenAPI path when it does -- this file is the freeze point
 * so that task doesn't have to reverse-engineer the contract from a doc
 * table.
 */

import type { ScreenId } from "./screens.js";

export type OperationStatus = "SPECIFIED" | "IMPLEMENTED";

export interface ActionContract {
  /** Engineering identifier, never shown as user-facing text (docs/ux/action-api-catalog.md). */
  action: string;
  screen: ScreenId;
  operationId: string;
  resultSummary: string;
  /** Free-text next state/screen description -- not always a screen change (e.g. same-screen state transition). */
  next: string;
  operationStatus: OperationStatus;
  /** Which Phase 1 task is expected to implement the real endpoint. */
  ownerTask: string;
}

export const ACTIONS: ActionContract[] = [
  {
    action: "task.publish",
    screen: "P-TASK-BUILDER",
    operationId: "task.publish",
    resultSummary: "assignment created",
    next: "P-DASH",
    operationStatus: "SPECIFIED",
    ownerTask: "P1-002",
  },
  {
    action: "task.attempt.start",
    screen: "C-TASK",
    operationId: "task.attempt.start",
    resultSummary: "attempt created",
    next: "C-TASK (state: IN_PROGRESS)",
    operationStatus: "SPECIFIED",
    ownerTask: "P1-002",
  },
  {
    action: "task.evidence.submit",
    screen: "C-TASK",
    operationId: "task.evidence.submit",
    resultSummary: "evidence accepted",
    next: "C-TASK (state: VERIFYING)",
    operationStatus: "SPECIFIED",
    ownerTask: "P1-002",
  },
  {
    action: "task.approval.approve",
    screen: "P-APPROVALS",
    operationId: "task.approval.approve",
    resultSummary: "completion confirmed",
    next: "P-DASH (reward processing)",
    operationStatus: "SPECIFIED",
    ownerTask: "P1-002",
  },
  {
    action: "task.approval.return",
    screen: "P-APPROVALS",
    operationId: "task.approval.return",
    resultSummary: "correction requested",
    next: "P-DASH; child sees C-TASK (state: RETRYABLE_FAILURE)",
    operationStatus: "SPECIFIED",
    ownerTask: "P1-002",
  },
  {
    action: "reward.redeem",
    screen: "P-REWARDS",
    operationId: "reward.redeem",
    resultSummary: "redemption created",
    next: "P-REWARDS (state: REDEEMED)",
    operationStatus: "SPECIFIED",
    ownerTask: "P1-006",
  },
];
