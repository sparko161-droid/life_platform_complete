import assert from "node:assert/strict";
import { test } from "node:test";
import { DEPRECATION_REGISTRY, DeprecationNoticeSchema, validateDeprecationNotice } from "../src/deprecation.js";

const VALID_NOTICE = {
  surface: "domain-events",
  subject: "TASK_TEMPLATE_CREATED",
  consumers: ["progression-service"],
  owner: "chief-architect",
  targetRemovalCondition: "No consumer subscribes to TASK_TEMPLATE_CREATED for 2 consecutive releases.",
  migrationPath: "Subscribe to TASK_TEMPLATE_PUBLISHED instead.",
  announcedAt: "2026-08-18T00:00:00.000Z",
};

test("DeprecationNoticeSchema: a well-formed notice parses", () => {
  const result = DeprecationNoticeSchema.safeParse(VALID_NOTICE);
  assert.equal(result.success, true);
});

test("validateDeprecationNotice: valid notice has no issues", () => {
  assert.deepEqual(validateDeprecationNotice(VALID_NOTICE), []);
});

test("validateDeprecationNotice: missing owner is reported", () => {
  const { owner: _owner, ...rest } = VALID_NOTICE;
  const issues = validateDeprecationNotice(rest);
  assert.ok(issues.some((i) => i.includes("owner")));
});

test("validateDeprecationNotice: empty consumers array is rejected", () => {
  const issues = validateDeprecationNotice({ ...VALID_NOTICE, consumers: [] });
  assert.ok(issues.some((i) => i.includes("consumers")));
});

test("validateDeprecationNotice: unknown surface is rejected", () => {
  const issues = validateDeprecationNotice({ ...VALID_NOTICE, surface: "smoke-signals" });
  assert.ok(issues.some((i) => i.includes("surface")));
});

test("validateDeprecationNotice: blank migrationPath is rejected", () => {
  const issues = validateDeprecationNotice({ ...VALID_NOTICE, migrationPath: "" });
  assert.ok(issues.some((i) => i.includes("migrationPath")));
});

test("DEPRECATION_REGISTRY: starts empty (nothing deprecated yet in Phase 1)", () => {
  assert.deepEqual(DEPRECATION_REGISTRY, []);
});

test("DEPRECATION_REGISTRY: every entry, if any, is itself a valid notice", () => {
  for (const entry of DEPRECATION_REGISTRY) {
    assert.deepEqual(validateDeprecationNotice(entry), []);
  }
});
