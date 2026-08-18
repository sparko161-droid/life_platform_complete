import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateFeatureFlag } from "../src/feature-flags.js";

test("evaluateFeatureFlag: a disabled flag is always off, even for allowlisted subjects", () => {
  const flag = { key: "new-onboarding", enabled: false, allowlist: ["family-1"] };
  assert.equal(evaluateFeatureFlag(flag, { subjectId: "family-1" }), false);
});

test("evaluateFeatureFlag: enabled with no rollout/allow/deny is fully on", () => {
  const flag = { key: "new-onboarding", enabled: true };
  assert.equal(evaluateFeatureFlag(flag, { subjectId: "family-1" }), true);
  assert.equal(evaluateFeatureFlag(flag, { subjectId: "family-2" }), true);
});

test("evaluateFeatureFlag: denylist wins over allowlist", () => {
  const flag = { key: "k", enabled: true, allowlist: ["family-1"], denylist: ["family-1"] };
  assert.equal(evaluateFeatureFlag(flag, { subjectId: "family-1" }), false);
});

test("evaluateFeatureFlag: allowlisted subject is on regardless of rolloutPercentage", () => {
  const flag = { key: "k", enabled: true, allowlist: ["family-1"], rolloutPercentage: 0 };
  assert.equal(evaluateFeatureFlag(flag, { subjectId: "family-1" }), true);
});

test("evaluateFeatureFlag: rolloutPercentage 0 is off for a non-allowlisted subject", () => {
  const flag = { key: "k", enabled: true, rolloutPercentage: 0 };
  assert.equal(evaluateFeatureFlag(flag, { subjectId: "family-1" }), false);
});

test("evaluateFeatureFlag: rolloutPercentage 100 is on for any subject", () => {
  const flag = { key: "k", enabled: true, rolloutPercentage: 100 };
  for (const id of ["a", "b", "c", "family-42"]) {
    assert.equal(evaluateFeatureFlag(flag, { subjectId: id }), true);
  }
});

test("evaluateFeatureFlag: is deterministic for the same flag+subject", () => {
  const flag = { key: "k", enabled: true, rolloutPercentage: 50 };
  const first = evaluateFeatureFlag(flag, { subjectId: "family-7" });
  for (let i = 0; i < 20; i++) {
    assert.equal(evaluateFeatureFlag(flag, { subjectId: "family-7" }), first);
  }
});

test("evaluateFeatureFlag: a mid rollout percentage produces a mixed on/off split across many subjects", () => {
  const flag = { key: "k", enabled: true, rolloutPercentage: 50 };
  let on = 0;
  const total = 500;
  for (let i = 0; i < total; i++) {
    if (evaluateFeatureFlag(flag, { subjectId: `family-${i}` })) on++;
  }
  // Not asserting an exact bucket count (hash-dependent) -- only that the
  // rollout percentage actually splits the population instead of being an
  // effective on/off switch.
  assert.ok(on > total * 0.3 && on < total * 0.7, `expected a roughly 50/50 split, got ${on}/${total} on`);
});

test("evaluateFeatureFlag: two different flag keys can bucket the same subject differently", () => {
  const subject = { subjectId: "family-99" };
  const results = new Set<boolean>();
  for (let i = 0; i < 10; i++) {
    results.add(evaluateFeatureFlag({ key: `flag-${i}`, enabled: true, rolloutPercentage: 50 }, subject));
  }
  // With 10 independently-keyed 50% flags evaluated for the same subject,
  // both outcomes should appear at least once (hash-dependent but
  // overwhelmingly likely; a bug that ignores `key` in bucketing would
  // instead always produce a single value here).
  assert.equal(results.size, 2);
});
