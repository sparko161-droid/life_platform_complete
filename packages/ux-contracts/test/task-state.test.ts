import assert from "node:assert/strict";
import { test } from "node:test";
import { TASK_ASSIGNMENT_STATUSES } from "@life/domain-types";
import { deriveUiTaskState, UI_TASK_STATES } from "../src/task-state.js";

test("every assignment status derives to a known UI state", () => {
  for (const status of TASK_ASSIGNMENT_STATUSES) {
    const uiState = deriveUiTaskState({ assignmentStatus: status });
    assert.ok(UI_TASK_STATES.includes(uiState), `${status} derived to unknown UI state ${uiState}`);
  }
});

test("ASSIGNED -> NOT_STARTED (the one status with no like-named UI equivalent)", () => {
  assert.equal(deriveUiTaskState({ assignmentStatus: "ASSIGNED" }), "NOT_STARTED");
});

test("REJECTED by a parent shows REJECTED, not FAILED", () => {
  const state = deriveUiTaskState({ assignmentStatus: "REJECTED", rejectedByParent: true, latestVerificationOutcome: "FAILED" });
  assert.equal(state, "REJECTED");
});

test("REJECTED from an automatic FAILED verification (no parent involved) shows FAILED", () => {
  const state = deriveUiTaskState({ assignmentStatus: "REJECTED", latestVerificationOutcome: "FAILED" });
  assert.equal(state, "FAILED");
});

test("REJECTED with no distinguishing signal defaults to REJECTED (conservative, not a guessed FAILED)", () => {
  const state = deriveUiTaskState({ assignmentStatus: "REJECTED" });
  assert.equal(state, "REJECTED");
});

test("APPROVED without a ledgered reward shows REWARD_PENDING", () => {
  const state = deriveUiTaskState({ assignmentStatus: "APPROVED", rewardLedgered: false });
  assert.equal(state, "REWARD_PENDING");
});

test("APPROVED with a ledgered reward shows COMPLETED", () => {
  const state = deriveUiTaskState({ assignmentStatus: "APPROVED", rewardLedgered: true });
  assert.equal(state, "COMPLETED");
});

test("COMPLETED and ARCHIVED both show COMPLETED to the UI", () => {
  assert.equal(deriveUiTaskState({ assignmentStatus: "COMPLETED" }), "COMPLETED");
  assert.equal(deriveUiTaskState({ assignmentStatus: "ARCHIVED" }), "COMPLETED");
});
