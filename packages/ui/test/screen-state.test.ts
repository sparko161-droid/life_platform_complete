import assert from "node:assert/strict";
import { test } from "node:test";
import { SCREENS } from "@life/ux-contracts";
import { defineScreenStates, screenStateGaps } from "../src/screen-state.js";

/**
 * Exhaustive screen-state handling (P1-016).
 *
 * The point of this mechanism is that a missing state is a compile
 * error, so most of its value is in the type system and cannot be
 * asserted at runtime. What these tests cover is the part types cannot:
 * that the runtime gap check agrees with the contract, and that it
 * actually reports a gap rather than quietly passing.
 */

test("a complete handler reports no gaps", () => {
  const handler = defineScreenStates("P-REGISTRATION", {
    LOADING: "loading",
    READY: "ready",
    SUBMITTING: "submitting",
    VALIDATION_ERROR: "validation",
    SIGN_IN_FAILED: "failed",
    TOO_MANY_ATTEMPTS: "throttled",
    NETWORK_ERROR: "network",
    OFFLINE: "offline",
  });
  assert.deepEqual(screenStateGaps(handler), { missing: [], extra: [] });
});

test("render resolves every declared state", () => {
  const handler = defineScreenStates("P-REGISTRATION", {
    LOADING: 1,
    READY: 2,
    SUBMITTING: 3,
    VALIDATION_ERROR: 4,
    SIGN_IN_FAILED: 5,
    TOO_MANY_ATTEMPTS: 6,
    NETWORK_ERROR: 7,
    OFFLINE: 8,
  });
  for (const state of SCREENS["P-REGISTRATION"].states) {
    assert.equal(typeof handler.tryRender(state), "number", `${state} has no rendering path`);
  }
});

test("the gap check actually catches a missing state", () => {
  // Built by hand rather than through defineScreenStates, because the
  // type system correctly refuses to express this -- which is the whole
  // point. This simulates the one case types cannot see: a prebuilt dist
  // compiled against an older contract, the same stale-build problem
  // ci.yml already documents.
  const incomplete = {
    screenId: "P-REGISTRATION" as const,
    states: { LOADING: "x", READY: "x" },
    render: () => "x",
    tryRender: () => "x",
  };
  const gaps = screenStateGaps(incomplete as never);
  assert.ok(gaps.missing.includes("OFFLINE"), "a skipped OFFLINE state must be reported");
  assert.ok(gaps.missing.length > 0);
});

test("the gap check catches a state the contract no longer declares", () => {
  // The direction that catches a renamed state left behind in the UI.
  const stale = {
    screenId: "P-REGISTRATION" as const,
    states: {
      LOADING: "x",
      READY: "x",
      SUBMITTING: "x",
      VALIDATION_ERROR: "x",
      SIGN_IN_FAILED: "x",
      TOO_MANY_ATTEMPTS: "x",
      NETWORK_ERROR: "x",
      OFFLINE: "x",
      RENAMED_AWAY: "x",
    },
    render: () => "x",
    tryRender: () => "x",
  };
  const gaps = screenStateGaps(stale as never);
  assert.deepEqual(gaps.extra, ["RENAMED_AWAY"]);
  assert.deepEqual(gaps.missing, []);
});

test("tryRender returns undefined for an unrecognised state rather than throwing", () => {
  const handler = defineScreenStates("P-FAMILY-SETUP", {
    LOADING: "a",
    NO_FAMILY: "b",
    CREATING_FAMILY: "c",
    FAMILY_READY_NO_CHILDREN: "d",
    ADDING_CHILD: "e",
    CHILD_ADDED: "f",
    PROVISIONING_CHILD_ACCESS: "g",
    CHILD_ACCESS_READY: "h",
    VALIDATION_ERROR: "i",
    NETWORK_ERROR: "j",
    OFFLINE: "k",
  });
  // A state from a newer server than this client knows about is stale
  // data, not necessarily a bug -- the caller decides which.
  assert.equal(handler.tryRender("SOMETHING_NEWER"), undefined);
});

test("every frozen screen declares at least one state, and none are duplicated", () => {
  for (const screen of Object.values(SCREENS)) {
    assert.ok(screen.states.length > 0, `${screen.id} declares no states`);
    assert.equal(
      new Set(screen.states).size,
      screen.states.length,
      `${screen.id} declares a duplicate state`,
    );
  }
});
