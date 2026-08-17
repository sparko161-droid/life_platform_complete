import assert from "node:assert/strict";
import { test } from "node:test";
import { branchName } from "../src/worktree.js";
import type { Task } from "../src/schema.js";

function baseTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "P0-004",
    phase: 0,
    title: "Implement agent worktree and handoff conventions",
    primary: "ai-cto",
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

test("branchName derives agent/<role>/<id>-<slug> from the title", () => {
  const branch = branchName(baseTask(), "ai-cto");
  assert.equal(branch, "agent/ai-cto/P0-004-implement-agent-worktree-and-handoff");
});

test("branchName accepts an explicit slug override", () => {
  const branch = branchName(baseTask(), "ai-cto", "worktree-conventions");
  assert.equal(branch, "agent/ai-cto/P0-004-worktree-conventions");
});

test("branchName lowercases and strips punctuation from the title", () => {
  const task = baseTask({ title: "Fix: Foo/Bar (baz)!!" });
  const branch = branchName(task, "backend-lead");
  assert.equal(branch, "agent/backend-lead/P0-004-fix-foo-bar-baz");
});
