import assert from "node:assert/strict";
import { test } from "node:test";
import { allowedNextStates, isValidTransition, readyAdmissionProblems } from "../src/schema.js";
import { claimableTasks, outstandingDecisions, validateStructure } from "../src/registry.js";
import type { Registry, Task } from "../src/schema.js";

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
    execution: {
      wave: "W0",
      priority: "P2",
      acceptance_criteria: "accept",
      test_strategy: "tests",
      source_reference: "test",
    },
    ...overrides,
  };
}

test("readyAdmissionProblems requires independent reviewer, gates and execution metadata", () => {
  const task = baseTask();
  assert.deepEqual(readyAdmissionProblems(task), [
    "missing independent reviewer",
    "missing gate owners",
  ]);
});

test("readyAdmissionProblems passes when all required admission metadata exists", () => {
  const task = baseTask({ reviewer: "qa-lead", gate_owners: ["qa-lead"] });
  assert.deepEqual(readyAdmissionProblems(task), []);
});

test("readyAdmissionProblems blocks unresolved discovery and human decision", () => {
  const task = baseTask({
    reviewer: "qa-lead",
    gate_owners: ["qa-lead"],
    discovery_links: [{
      discovery_id: "DISC-1",
      source_task: "P0-001",
      type: "SECURITY_FINDING",
      finding: "f",
      why_it_matters: "w",
      affected_domains: [],
      architecture_impact: null,
      security_impact: null,
      ux_impact: null,
      recommended_solution: null,
      alternatives: [],
      priority: "HIGH",
      blocking: true,
      proposed_task: null,
    }],
    human_decisions: [{ decision_id: "D1", question: "q", decision: null, decided_at: null }],
  });
  assert.ok(readyAdmissionProblems(task).includes("blocking discovery remains unresolved"));
  assert.ok(readyAdmissionProblems(task).includes("unresolved human decision remains"));
});

test("validateStructure flags READY admission defects", () => {
  const registry: Registry = {
    version: 1,
    tasks: [baseTask({ id: "P1-001" })],
  };
  const problems = validateStructure(registry);
  assert.ok(problems.some((p) => p.includes("P1-001: missing independent reviewer")));
  assert.ok(problems.some((p) => p.includes("P1-001: missing gate owners")));
});

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
  assert.deepEqual(validateStructure(registry).filter((p) => p.includes("admission")), []);
});

test("claimableTasks: only READY tasks with every dep DONE", () => {
  const registry: Registry = {
    version: 1,
    tasks: [
      baseTask({ id: "P0-001", status: "DONE", deps: [] }),
      baseTask({ id: "P0-002", status: "IN_PROGRESS", deps: [] }),
      baseTask({ id: "P1-001", status: "READY", deps: ["P0-001"], reviewer: "qa-lead", gate_owners: ["qa-lead"] }),
      baseTask({ id: "P1-002", status: "READY", deps: ["P0-002"], reviewer: "qa-lead", gate_owners: ["qa-lead"] }),
      baseTask({ id: "P1-003", status: "BACKLOG", deps: ["P0-001"] }),
    ],
  };
  const claimable = claimableTasks(registry).map((t) => t.id);
  assert.deepEqual(claimable, ["P1-001"]);
});

test("claimableTasks: sorted by phase then id", () => {
  const registry: Registry = {
    version: 1,
    tasks: [
      baseTask({ id: "P2-002", phase: 2, status: "READY", deps: [], reviewer: "qa-lead", gate_owners: ["qa-lead"] }),
      baseTask({ id: "P1-001", phase: 1, status: "READY", deps: [], reviewer: "qa-lead", gate_owners: ["qa-lead"] }),
      baseTask({ id: "P1-000", phase: 1, status: "READY", deps: [], reviewer: "qa-lead", gate_owners: ["qa-lead"] }),
    ],
  };
  const claimable = claimableTasks(registry).map((t) => t.id);
  assert.deepEqual(claimable, ["P1-000", "P1-001", "P2-002"]);
});

test("claimableTasks: --role narrows to one primary", () => {
  const registry: Registry = {
    version: 1,
    tasks: [
      baseTask({ id: "P1-001", status: "READY", primary: "backend-lead", deps: [], reviewer: "qa-lead", gate_owners: ["qa-lead"] }),
      baseTask({ id: "P1-002", status: "READY", primary: "frontend-lead", deps: [], reviewer: "qa-lead", gate_owners: ["qa-lead"] }),
    ],
  };
  const claimable = claimableTasks(registry, { role: "frontend-lead" }).map((t: Task) => t.id);
  assert.deepEqual(claimable, ["P1-002"]);
});

test("outstandingDecisions: empty registry has nothing outstanding", () => {
  const registry: Registry = { version: 1, tasks: [baseTask()] };
  assert.deepEqual(outstandingDecisions(registry), []);
});

test("outstandingDecisions: a *_BLOCKED task surfaces its reason", () => {
  const registry: Registry = {
    version: 1,
    tasks: [baseTask({ id: "P1-003", status: "PRODUCT_BLOCKED", blocked_reason: "needs pricing decision" })],
  };
  const items = outstandingDecisions(registry);
  assert.deepEqual(items, [{ taskId: "P1-003", kind: "blocked", summary: "PRODUCT_BLOCKED: needs pricing decision" }]);
});

test("outstandingDecisions: only unresolved human_decisions surface, not answered ones", () => {
  const registry: Registry = {
    version: 1,
    tasks: [baseTask({
      id: "P1-004",
      reviewer: "qa-lead",
      gate_owners: ["qa-lead"],
      human_decisions: [
        { decision_id: "D1", question: "Currency for money rewards?", decision: null, decided_at: null },
        { decision_id: "D2", question: "Already answered?", decision: "RUB", decided_at: "2026-01-01" },
      ],
    })],
  };
  const items = outstandingDecisions(registry);
  assert.deepEqual(items, [{ taskId: "P1-004", kind: "human_decision", summary: "Currency for money rewards?" }]);
});

test("outstandingDecisions: only blocking discoveries surface, not informational ones", () => {
  const baseDiscovery = {
    source_task: "P1-005",
    type: "MISSING_REQUIREMENT" as const,
    finding: "f",
    why_it_matters: "w",
    affected_domains: [],
    architecture_impact: null,
    security_impact: null,
    ux_impact: null,
    recommended_solution: null,
    alternatives: [],
    priority: "HIGH" as const,
    proposed_task: null,
  };
  const registry: Registry = {
    version: 1,
    tasks: [baseTask({
      id: "P1-005",
      discovery_links: [
        { ...baseDiscovery, discovery_id: "DISC-1", blocking: true },
        { ...baseDiscovery, discovery_id: "DISC-2", blocking: false },
      ],
    })],
  };
  const items = outstandingDecisions(registry);
  assert.deepEqual(items, [{ taskId: "P1-005", kind: "blocking_discovery", summary: "DISC-1: f" }]);
});
