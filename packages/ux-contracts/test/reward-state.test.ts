import assert from "node:assert/strict";
import { test } from "node:test";
import { REWARD_STATUSES } from "@life/domain-types";
import { REWARD_STATUS_TO_UI_STATE, UI_REWARD_STATES, cancelledRewardUiState } from "../src/reward-state.js";

test("every non-CANCELLED reward status has a direct UI mapping", () => {
  for (const status of REWARD_STATUSES) {
    if (status === "CANCELLED") continue;
    const uiState = REWARD_STATUS_TO_UI_STATE[status];
    assert.ok(UI_REWARD_STATES.includes(uiState), `${status} maps to unknown UI state ${uiState}`);
    assert.equal(uiState, status, `${status} should map to itself (names line up 1:1 except CANCELLED)`);
  }
});

test("CANCELLED renders as EXPIRED (no dedicated card state), not as UI FAILED", () => {
  assert.equal(cancelledRewardUiState(), "EXPIRED");
});
