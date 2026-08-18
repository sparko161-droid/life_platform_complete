import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { SCREENS, SCREEN_IDS } from "../src/screens.js";
import { ACTIONS } from "../src/actions.js";
import {
  CANONICAL_SCREEN_IDS,
  RETIRED_SCREEN_IDS,
  SPECIFIED_SCREEN_IDS,
  resolveScreenId,
} from "../src/screen-id-registry.js";

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
  const known = new Set<string>(CANONICAL_SCREEN_IDS);
  for (const action of ACTIONS) {
    assert.ok(known.has(action.screen), `action "${action.action}" references unknown screen ${action.screen}`);
  }
});

test("action ids are unique", () => {
  const ids = ACTIONS.map((a) => a.action);
  assert.deepEqual(ids, [...new Set(ids)]);
});

test("operationStatus and openapiOperationId agree: IMPLEMENTED has a real id, SPECIFIED doesn't claim one", () => {
  for (const action of ACTIONS) {
    if (action.operationStatus === "IMPLEMENTED") {
      assert.ok(action.openapiOperationId, `${action.action} is IMPLEMENTED but has no openapiOperationId`);
    } else {
      assert.equal(action.openapiOperationId, null, `${action.action} is SPECIFIED but claims openapiOperationId ${action.openapiOperationId}`);
    }
  }
});

// --- Canonical screen identity (P1-013 / BLK-P1-001) ---

const SCREENS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../../docs/ux/screens");

/**
 * The id each screen document declares on its own `**ID:**` /
 * `**Screen ID:**` line. Read from the docs rather than from a hand-kept
 * list, so a document that drifts is caught instead of a copy of it.
 */
function declaredScreenIds(): Record<string, string> {
  const declared: Record<string, string> = {};
  for (const file of readdirSync(SCREENS_DIR)) {
    if (!file.endsWith(".md")) continue;
    const text = readFileSync(resolve(SCREENS_DIR, file), "utf8");
    const match = /^\*\*(?:ID|Screen ID)[^*]*\*\*\s*(\S+)/mu.exec(text);
    if (match?.[1]) declared[file] = match[1];
  }
  return declared;
}

test("every retired positional id resolves to a canonical id", () => {
  const canonical = new Set<string>(CANONICAL_SCREEN_IDS);
  for (const [retired, target] of Object.entries(RETIRED_SCREEN_IDS)) {
    assert.ok(canonical.has(target), `${retired} maps to unknown canonical id ${target}`);
  }
});

test("the canonical namespace has no duplicates and no id is both frozen and merely specified", () => {
  assert.deepEqual([...CANONICAL_SCREEN_IDS], [...new Set(CANONICAL_SCREEN_IDS)]);
  const frozen = new Set<string>(SCREEN_IDS);
  for (const id of SPECIFIED_SCREEN_IDS) {
    assert.ok(!frozen.has(id), `${id} is listed as specified but already has a frozen contract`);
  }
});

test("resolveScreenId accepts canonical and retired ids, and rejects anything else", () => {
  assert.equal(resolveScreenId("C-TODAY"), "C-TODAY");
  assert.equal(resolveScreenId("P-REGISTRATION"), "P-REGISTRATION");
  assert.equal(resolveScreenId("UX-CHI-02"), "C-TODAY");
  // The one screen that was filed under two positional ids.
  assert.equal(resolveScreenId("UX-PAR-05"), "P-REWARDS");
  assert.equal(resolveScreenId("UX-CHI-06"), "P-REWARDS");
  assert.equal(resolveScreenId("UX-CHI-99"), undefined);
});

test("every screen document declares a canonical id, and none still declares a retired one", () => {
  const canonical = new Set<string>(CANONICAL_SCREEN_IDS);
  const problems: string[] = [];
  for (const [file, id] of Object.entries(declaredScreenIds())) {
    if (!canonical.has(id)) {
      problems.push(`${file} declares non-canonical id ${id}`);
    }
  }
  assert.deepEqual(problems, []);
});

test("every canonical screen id is declared by exactly one document", () => {
  const byId = new Map<string, string[]>();
  for (const [file, id] of Object.entries(declaredScreenIds())) {
    byId.set(id, [...(byId.get(id) ?? []), file]);
  }
  const problems: string[] = [];
  for (const id of CANONICAL_SCREEN_IDS) {
    const files = byId.get(id) ?? [];
    if (files.length !== 1) problems.push(`${id}: declared by ${files.length} document(s) ${files.join(", ")}`);
  }
  assert.deepEqual(problems, []);
});

test("the action catalog covers the whole Phase 1 exit journey", () => {
  // docs/planning/phase-1-execution-plan.md's non-negotiable exit journey,
  // as operation ids. Listed explicitly so adding a screen contract can
  // never quietly shrink what "the Phase 1 slice" means.
  const journey = [
    "family.create",
    "family.parent.invite",
    "child.create",
    "task.publish",
    "task.attempt.start",
    "task.evidence.submit",
    "task.approval.approve",
    "task.approval.return",
    "reward.redeem",
  ];
  const known = new Set(ACTIONS.map((a) => a.operationId));
  const missing = journey.filter((op) => !known.has(op));
  assert.deepEqual(missing, []);
});
