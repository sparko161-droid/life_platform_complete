import assert from "node:assert/strict";
import { test } from "node:test";
import { SCREENS, SCREEN_IDS } from "../src/screens.js";
import { ACTIONS } from "../src/actions.js";

test("every screen id in SCREENS matches SCREEN_IDS exactly (no drift between the two)", () => {
  const keys = Object.keys(SCREENS).sort();
  const ids = [...SCREEN_IDS].sort();
  assert.deepEqual(keys, ids);
});

test("every entryFrom/exitTo reference points at a real screen id", () => {
  const known = new Set(SCREEN_IDS);
  for (const screen of Object.values(SCREENS)) {
    for (const id of [...screen.entryFrom, ...screen.exitTo]) {
      assert.ok(known.has(id), `${screen.id} references unknown screen ${id}`);
    }
  }
});

test("every exitTo edge has a matching entryFrom on the target (the graph is consistent, not just one-directional)", () => {
  for (const screen of Object.values(SCREENS)) {
    for (const targetId of screen.exitTo) {
      const target = SCREENS[targetId];
      assert.ok(
        target.entryFrom.includes(screen.id),
        `${screen.id} -> ${targetId} has no matching entryFrom on ${targetId}`,
      );
    }
  }
});

test("every action references a real screen id", () => {
  const known = new Set(SCREEN_IDS);
  for (const action of ACTIONS) {
    assert.ok(known.has(action.screen), `action "${action.action}" references unknown screen ${action.screen}`);
  }
});

test("action ids are unique", () => {
  const ids = ACTIONS.map((a) => a.action);
  assert.deepEqual(ids, [...new Set(ids)]);
});
