import assert from "node:assert/strict";
import { test } from "node:test";
import { COMPATIBILITY_RULES, coversAllSurfaces } from "../src/compatibility-rules.js";
import { VERSIONED_SURFACES } from "../src/surfaces.js";

test("COMPATIBILITY_RULES: covers every VERSIONED_SURFACES entry exactly once", () => {
  const surfaces = COMPATIBILITY_RULES.map((r) => r.surface);
  assert.equal(surfaces.length, VERSIONED_SURFACES.length);
  assert.equal(new Set(surfaces).size, surfaces.length); // no duplicates
  assert.equal(coversAllSurfaces(COMPATIBILITY_RULES), true);
});

test("coversAllSurfaces: false when a surface is missing", () => {
  const incomplete = COMPATIBILITY_RULES.slice(1);
  assert.equal(coversAllSurfaces(incomplete), false);
});

test("COMPATIBILITY_RULES: every rule cites a non-empty example and reference", () => {
  for (const rule of COMPATIBILITY_RULES) {
    assert.ok(rule.breakingExample.length > 0, `empty breakingExample for ${rule.surface}`);
    assert.ok(rule.nonBreakingExample.length > 0, `empty nonBreakingExample for ${rule.surface}`);
    assert.ok(rule.reference.length > 0, `empty reference for ${rule.surface}`);
  }
});
