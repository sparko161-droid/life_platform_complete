import assert from "node:assert/strict";
import { test } from "node:test";
import { allowedNextStates, isValidTransition, readyAdmissionProblems, taskSchema } from "../src/schema.js";
import { claimableTasks, outstandingDecisions, validateStructure } from "../src/registry.js";
import type { Registry, Task } from "../src/schema.js";

test("task id accepts a split-task letter suffix (P1-002A/P1-002B, docs/governance/task-admission.md's 'split into reviewable units')", () => {
  const base = baseTask({ id: "P1-002A" });
  assert.doesNotThrow(() => taskSchema.parse(base));
  assert.doesNotThrow(() => taskSchema.parse(baseTask({ id: "P1-002B" })));
});

test("task id still rejects a genuinely malformed id", () => {
  assert.throws(() => taskSchema.parse(baseTask({ id: "not-a-task-id" })));
  assert.throws(() => taskSchema.parse(baseTask({ id: "P1-2" }))); // needs at least 3 digits
});

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
    // Non-null by default so the "clean" fixture genuinely satisfies
    // readyAdmissionProblems() -- a base task fixture with status READY
    // should represent a *valid* READY task unless a test deliberately
    // overrides a field to test incompleteness.
    reviewer: "chief-architect",
    gate_owners: ["qa-lead"],
    discovery_links: [],
    blocked_reason: null,
    human_decisions: [],
    origin_discovery: null,
    discovered_from: null,
    execution: {
      wave: "W1",
      priority: "P1",
      acceptance_criteria: "acceptance",
      test_strategy: "tests",
      source_reference: "docs/planning/phases/phase-0.md",
    },
    ...overrides,
  };
}

test("readyAdmissionProblems: a fully-specified task has no problems (docs/governance/task-admission.md)", () => {
  assert.deepEqual(readyAdmissionProblems(baseTask()), []);
});

test("readyAdmissionProblems: flags each missing piece of mandatory metadata independently", () => {
  assert.ok(readyAdmissionProblems(baseTask({ reviewer: null })).includes("missing independent reviewer"));
  assert.ok(readyAdmissionProblems(baseTask({ gate_owners: [] })).includes("missing gate owners"));
  assert.ok(
    readyAdmissionProblems(baseTask({ execution: { ...baseTask().execution, wave: "UNASSIGNED" } })).includes(
      "missing wave assignment",
    ),
  );
  assert.ok(
    readyAdmissionProblems(baseTask({ execution: { ...baseTask().execution, acceptance_criteria: "" } })).includes(
      "missing acceptance criteria",
    ),
  );
  assert.ok(
    readyAdmissionProblems(baseTask({ execution: { ...baseTask().execution, test_strategy: "" } })).includes(
      "missing test strategy",
    ),
  );
  assert.ok(
    readyAdmissionProblems(baseTask({ execution: { ...baseTask().execution, source_reference: "" } })).includes(
      "missing source reference",
    ),
  );
});

test("readyAdmissionProblems: reviewer cannot be the same as primary", () => {
  const task = baseTask({ primary: "backend-lead", reviewer: "backend-lead" });
  assert.ok(readyAdmissionProblems(task).includes("reviewer must be independent from primary executor"));
});

test("readyAdmissionProblems: a blocking discovery or unresolved human decision blocks admission", () => {
  const blockingDiscovery = baseTask({
    discovery_links: [
      {
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
      },
    ],
  });
  assert.ok(readyAdmissionProblems(blockingDiscovery).includes("blocking discovery remains unresolved"));

  const unresolvedDecision = baseTask({
    human_decisions: [{ decision_id: "D1", question: "q", decision: null, decided_at: null }],
  });
  assert.ok(readyAdmissionProblems(unresolvedDecision).includes("unresolved human decision remains"));
});

test("validateStructure prefixes READY admission problems with the task id", () => {
  const registry: Registry = {
    version: 1,
    tasks: [baseTask({ id: "P1-777", status: "READY", reviewer: null })],
  };
  const problems = validateStructure(registry);
  assert.ok(problems.includes("P1-777: missing independent reviewer"));
});

test("validateStructure does not apply admission rules to non-READY tasks", () => {
  const registry: Registry = {
    version: 1,
    tasks: [baseTask({ id: "P1-778", status: "PLANNED", reviewer: null, gate_owners: [] })],
  };
  assert.deepEqual(validateStructure(registry), []);
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
  assert.deepEqual(validateStructure(registry), []);
});

test("claimableTasks: only READY tasks with every dep DONE", () => {
  const registry: Registry = {
    version: 1,
    tasks: [
      baseTask({ id: "P0-001", status: "DONE", deps: [] }),
      baseTask({ id: "P0-002", status: "IN_PROGRESS", deps: [] }),
      baseTask({ id: "P1-001", status: "READY", deps: ["P0-001"] }), // claimable
      baseTask({ id: "P1-002", status: "READY", deps: ["P0-002"] }), // dep not DONE
      baseTask({ id: "P1-003", status: "BACKLOG", deps: ["P0-001"] }), // wrong status
    ],
  };
  const claimable = claimableTasks(registry).map((t) => t.id);
  assert.deepEqual(claimable, ["P1-001"]);
});

test("claimableTasks: sorted by phase then id", () => {
  const registry: Registry = {
    version: 1,
    tasks: [
      baseTask({ id: "P2-002", phase: 2, status: "READY", deps: [] }),
      baseTask({ id: "P1-001", phase: 1, status: "READY", deps: [] }),
      baseTask({ id: "P1-000", phase: 1, status: "READY", deps: [] }),
    ],
  };
  const claimable = claimableTasks(registry).map((t) => t.id);
  assert.deepEqual(claimable, ["P1-000", "P1-001", "P2-002"]);
});

test("claimableTasks: --role narrows to one primary", () => {
  const registry: Registry = {
    version: 1,
    tasks: [
      baseTask({ id: "P1-001", status: "READY", primary: "backend-lead", deps: [] }),
      baseTask({ id: "P1-002", status: "READY", primary: "frontend-lead", deps: [] }),
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
    tasks: [
      baseTask({
        id: "P1-004",
        human_decisions: [
          { decision_id: "D1", question: "Currency for money rewards?", decision: null, decided_at: null },
          { decision_id: "D2", question: "Already answered?", decision: "RUB", decided_at: "2026-01-01" },
        ],
      }),
    ],
  };
  const items = outstandingDecisions(registry);
  assert.deepEqual(items, [{ taskId: "P1-004", kind: "human_decision", summary: "Currency for money rewards?" }]);
});

test("outstandingDecisions: only blocking discoveries surface, not informational ones", () => {
  const baseDiscovery = {
    source_task: "P1-005",
    type: "MISSING_REQUIREMENT",
    finding: "f",
    why_it_matters: "w",
    affected_domains: [],
    architecture_impact: null,
    security_impact: null,
    ux_impact: null,
    recommended_solution: null,
    alternatives: [],
    priority: "HIGH",
    proposed_task: null,
  };
  const registry: Registry = {
    version: 1,
    tasks: [
      baseTask({
        id: "P1-005",
        discovery_links: [
          { ...baseDiscovery, discovery_id: "DISC-1", finding: "blocking one", blocking: true },
          { ...baseDiscovery, discovery_id: "DISC-2", finding: "fyi only", blocking: false },
        ],
      }),
    ],
  };
  const items = outstandingDecisions(registry);
  assert.deepEqual(items, [{ taskId: "P1-005", kind: "blocking_discovery", summary: "DISC-1: blocking one" }]);
});
