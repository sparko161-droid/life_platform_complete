import assert from "node:assert/strict";
import { test } from "node:test";
import { SCREENS, SCREEN_IDS } from "@life/ux-contracts";
import { lintString } from "@life/ui-language";
import { primaryNavFor, routesFor } from "../src/navigation.js";
import { REWARD_STATE_TONE, TASK_STATE_TONE, TONE_CLASSES } from "../src/tokens.js";

test("primary nav is derived from the contract, not hand-listed", () => {
  for (const surface of ["parent", "child"] as const) {
    const nav = primaryNavFor(surface);
    const expected = SCREEN_IDS.filter((id) => SCREENS[id].surface === surface && SCREENS[id].primaryNav);
    assert.deepEqual(
      nav.map((n) => n.screenId),
      expected,
      `${surface} nav must match exactly the primaryNav screens the contract declares`,
    );
  }
});

test("every nav route matches the screen contract's own route", () => {
  for (const surface of ["parent", "child"] as const) {
    for (const item of primaryNavFor(surface)) {
      assert.equal(item.route, SCREENS[item.screenId].route);
    }
  }
});

test("every nav label is Russian-only and free of forbidden terms", () => {
  for (const surface of ["parent", "child"] as const) {
    for (const item of primaryNavFor(surface)) {
      assert.deepEqual(
        lintString(item.screenId, item.label),
        [],
        `nav label for ${item.screenId} violates docs/ux/ui-language.md`,
      );
    }
  }
});

test("routesFor returns every contract route for a surface, nav or not", () => {
  const childRoutes = routesFor("child");
  assert.ok(childRoutes.includes("/child/task/:id"), "non-nav screens must still be routable");
  assert.equal(childRoutes.length, SCREEN_IDS.filter((id) => SCREENS[id].surface === "child").length);
});

test("state tone maps are exhaustive over the contract's UI states", () => {
  // Type-level exhaustiveness is enforced by Record<UiTaskState, _>;
  // this asserts the runtime object actually has every key, which a
  // partial object cast could otherwise hide.
  assert.equal(Object.keys(TASK_STATE_TONE).length, 9);
  assert.equal(Object.keys(REWARD_STATE_TONE).length, 6);
  for (const tone of [...Object.values(TASK_STATE_TONE), ...Object.values(REWARD_STATE_TONE)]) {
    assert.ok(TONE_CLASSES[tone], `tone ${tone} has no class mapping`);
  }
});

test("REJECTED and FAILED stay visually distinct", () => {
  // deriveUiTaskState keeps these apart on purpose: REJECTED is a parent
  // asking for another try, FAILED is an automatic verification miss.
  // Collapsing them to one colour would undo that in the UI.
  assert.notEqual(TASK_STATE_TONE.REJECTED, TASK_STATE_TONE.FAILED);
});
