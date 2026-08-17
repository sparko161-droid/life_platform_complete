import assert from "node:assert/strict";
import { test } from "node:test";
import { allowedNextStates, isValidTransition } from "../src/schema.js";
import { validateStructure } from "../src/registry.js";
import type { Registry } from "../src/schema.js";

test("READY -> IN_PROGRESS is allowed", () => {
  assert.equal(isValidTransition("READY", "IN_PROGRESS"), true);
});

test("READY -> DONE is not allowed (skips gates)", () => {
  assert.equal(isValidTransition("READY", "DONE"), false);
});

test("REVIEW allows QA, REWORK and PASS_WITH_DISCOVERIES", () => {
  const allowed = allowedNextStates("REVIEW");
  assert.ok(allowed.includes("QA"));
  assert.ok(allowed.includes("REWORK"));
  assert.ok(allowed.includes("PASS_WITH_DISCOVERIES"));
});

test("DONE and NEW_TASK are terminal", () => {
  assert.deepEqual(allowedNextStates("DONE"), []);
  assert.deepEqual(allowedNextStates("NEW_TASK"), []);
});

test("a state never transitions to itself", () => {
  assert.equal(isValidTransition("IN_PROGRESS", "IN_PROGRESS"), false);
});

function baseTask(overrides: Partial<Registry["tasks"][number]> = {}): Registry["tasks"][number] {
  return {
    id: "P0-001",
    phase: 0,
    title: "t",
    primary: "devops-lead",
    status: "READY",
    deps: [],
    reviewer: null,
    gate_owners: [],
    discovery_links: [],
    blocked_reason: null,
    human_decisions: [],
    origin_discovery: null,
    discovered_from: null,
    ...overrides,
  };
}

test("validateStructure flags unknown dependency ids", () => {
  const registry: Registry = {
    version: 1,
    tasks: [baseTask({ id: "P0-001", deps: ["P0-999"] })],
  };
  const problems = validateStructure(registry);
  assert.ok(problems.some((p) => p.includes("unknown dependency P0-999")));
});

test("validateStructure flags dependency cycles", () => {
  const registry: Registry = {
    version: 1,
    tasks: [
      baseTask({ id: "P0-001", deps: ["P0-002"] }),
      baseTask({ id: "P0-002", deps: ["P0-001"] }),
    ],
  };
  const problems = validateStructure(registry);
  assert.ok(problems.some((p) => p.startsWith("Dependency cycle:")));
});

test("validateStructure passes on a clean acyclic graph", () => {
  const registry: Registry = {
    version: 1,
    tasks: [
      baseTask({ id: "P0-001", deps: [] }),
      baseTask({ id: "P0-002", deps: ["P0-001"] }),
    ],
  };
  assert.deepEqual(validateStructure(registry), []);
});
