import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRegistry } from "../src/registry.js";
import { validateControlPlane } from "../src/control.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const fixtures = resolve(here, "fixtures/control");

// The real registry, deliberately: a control-plane fixture is only
// meaningful against real task statuses -- that is what "intentional
// drift" means here (P1-020's test strategy).
const taskRegistry = loadRegistry(resolve(repoRoot, "tasks/registry.yaml"));

function validate(dir: string, blockers = "blockers-clean.yaml"): string[] {
  return validateControlPlane({
    reviewsDir: resolve(fixtures, dir, "reviews"),
    phaseStatusPath: resolve(fixtures, "phase-status.yaml"),
    blockersPath: resolve(fixtures, blockers),
    taskRegistry,
  });
}

test("a complete, consistent review artifact passes", () => {
  assert.deepEqual(validate("clean"), []);
});

test("drift fails: a PASS review scoping a task that is not DONE", () => {
  // The fixture's placeholder task is a token, not a hardcoded id: the
  // original version of this test hardcoded P1-001, which was true only
  // until Phase 1 progress made it DONE (exactly the drift this test
  // exists to catch, ironically -- a fixture asserting against real task
  // statuses must not itself go stale as those statuses change). A
  // non-DONE task is resolved from the real registry at test time and
  // substituted into a temp copy of the fixture instead.
  const notDoneTask = taskRegistry.tasks.find((t) => t.status !== "DONE");
  assert.ok(notDoneTask, "expected at least one non-DONE task in the real registry to build this fixture against");

  const tempDir = mktempReviewsDir();
  const template = readFileSync(resolve(fixtures, "drift/reviews/W0.yaml"), "utf8");
  writeFileSync(
    resolve(tempDir, "W0.yaml"),
    template.replace(/__NOT_DONE_TASK_ID__/gu, notDoneTask!.id),
    "utf8",
  );

  const problems = validateControlPlane({
    reviewsDir: tempDir,
    phaseStatusPath: resolve(fixtures, "phase-status.yaml"),
    blockersPath: resolve(fixtures, "blockers-clean.yaml"),
    taskRegistry,
  });
  const expected = new RegExp(`decision is PASS but scoped task ${notDoneTask!.id} is ${notDoneTask!.status}`, "u");
  assert.ok(
    problems.some((p) => expected.test(p)),
    `expected drift to be caught, got: ${problems.join("; ")}`,
  );
});

function mktempReviewsDir(): string {
  const dir = mkdtempSync(resolve(tmpdir(), "control-drift-"));
  mkdirSync(dir, { recursive: true });
  return dir;
}

test("missing evidence fails: unaccounted areas, and a REWORK area under a PASS decision", () => {
  const problems = validate("missing-evidence");
  assert.ok(problems.some((p) => p.includes('evidence area "security_red_team" is not accounted for')));
  assert.ok(problems.some((p) => p.includes('evidence area "child_safety" is not accounted for')));
  assert.ok(problems.some((p) => p.includes('decision is PASS but "tests" is REWORK')));
});

test("an open blocker that still blocks the wave fails a PASS", () => {
  const problems = validate("clean", "blockers-open.yaml");
  assert.ok(
    problems.some((p) => /blocker BLK-FIX-002 is OPEN and blocks W0/u.test(p)),
    `expected the open blocker to be caught, got: ${problems.join("; ")}`,
  );
});

test("a wave claiming exit=PASS with no artifact at all fails", () => {
  // The empty directory stands in for the state the repo was actually in
  // before P1-020: wave statuses existed, review artifacts did not.
  const problems = validateControlPlane({
    reviewsDir: resolve(fixtures, "does-not-exist"),
    phaseStatusPath: resolve(fixtures, "phase-status.yaml"),
    blockersPath: resolve(fixtures, "blockers-clean.yaml"),
    taskRegistry,
  });
  assert.ok(problems.some((p) => p.includes("W0: status=DONE exit=PASS but no review artifact exists")));
});

test("the repository's own control plane is consistent", () => {
  const problems = validateControlPlane({
    reviewsDir: resolve(repoRoot, "tasks/reviews"),
    phaseStatusPath: resolve(repoRoot, "tasks/phase-1-status.yaml"),
    blockersPath: resolve(repoRoot, "tasks/phase-1-blockers.yaml"),
    taskRegistry,
  });
  assert.deepEqual(problems, []);
});
