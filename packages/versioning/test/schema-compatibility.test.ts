import assert from "node:assert/strict";
import { test } from "node:test";
import { FamilySchema, RewardSchema, TaskAssignmentSchema } from "@life/domain-types";
import { z } from "zod";
import { checkSchemaCompatibility } from "../src/schema-compatibility.js";

// ---------------------------------------------------------------------------
// Toy fixtures -- exercise each violation class in isolation
// ---------------------------------------------------------------------------

test("checkSchemaCompatibility: identical schema is compatible with itself", () => {
  const schema = z.object({ a: z.string(), b: z.number().optional() });
  const report = checkSchemaCompatibility(schema, schema);
  assert.equal(report.compatible, true);
  assert.deepEqual(report.violations, []);
});

test("checkSchemaCompatibility: adding an optional field is compatible", () => {
  const oldSchema = z.object({ a: z.string() });
  const newSchema = z.object({ a: z.string(), b: z.number().optional() });
  const report = checkSchemaCompatibility(oldSchema, newSchema);
  assert.equal(report.compatible, true);
});

test("checkSchemaCompatibility: adding a defaulted field is compatible", () => {
  const oldSchema = z.object({ a: z.string() });
  const newSchema = z.object({ a: z.string(), b: z.number().default(1) });
  const report = checkSchemaCompatibility(oldSchema, newSchema);
  assert.equal(report.compatible, true);
});

test("checkSchemaCompatibility: removing a field is REMOVED_FIELD", () => {
  const oldSchema = z.object({ a: z.string(), b: z.number() });
  const newSchema = z.object({ a: z.string() });
  const report = checkSchemaCompatibility(oldSchema, newSchema);
  assert.equal(report.compatible, false);
  assert.equal(report.violations.length, 1);
  assert.equal(report.violations[0]!.code, "REMOVED_FIELD");
  assert.equal(report.violations[0]!.field, "b");
});

test("checkSchemaCompatibility: an optional field becoming required is FIELD_BECAME_REQUIRED", () => {
  const oldSchema = z.object({ a: z.string(), b: z.number().optional() });
  const newSchema = z.object({ a: z.string(), b: z.number() });
  const report = checkSchemaCompatibility(oldSchema, newSchema);
  assert.equal(report.compatible, false);
  assert.equal(report.violations[0]!.code, "FIELD_BECAME_REQUIRED");
});

test("checkSchemaCompatibility: a new required field with no default is NEW_REQUIRED_FIELD_WITHOUT_DEFAULT", () => {
  const oldSchema = z.object({ a: z.string() });
  const newSchema = z.object({ a: z.string(), b: z.number() });
  const report = checkSchemaCompatibility(oldSchema, newSchema);
  assert.equal(report.compatible, false);
  assert.equal(report.violations[0]!.code, "NEW_REQUIRED_FIELD_WITHOUT_DEFAULT");
});

test("checkSchemaCompatibility: multiple violations are all reported, not just the first", () => {
  const oldSchema = z.object({ a: z.string(), b: z.number().optional(), c: z.string() });
  const newSchema = z.object({ b: z.number(), c: z.string(), d: z.boolean() });
  const report = checkSchemaCompatibility(oldSchema, newSchema);
  const codes = report.violations.map((v) => v.code).sort();
  assert.deepEqual(codes, ["FIELD_BECAME_REQUIRED", "NEW_REQUIRED_FIELD_WITHOUT_DEFAULT", "REMOVED_FIELD"]);
});

// ---------------------------------------------------------------------------
// Regression: run against the real shipped domain schemas
// ---------------------------------------------------------------------------

test("regression: every real domain schema is compatible with itself", () => {
  for (const schema of [FamilySchema, TaskAssignmentSchema, RewardSchema]) {
    const report = checkSchemaCompatibility(schema, schema);
    assert.equal(report.compatible, true, JSON.stringify(report.violations));
  }
});

test("regression: hypothetically removing FamilySchema's optimistic-concurrency field is caught", () => {
  const { version: _version, ...rest } = FamilySchema.shape;
  const hypotheticalNext = z.object(rest);
  const report = checkSchemaCompatibility(FamilySchema, hypotheticalNext);
  assert.equal(report.compatible, false);
  assert.ok(report.violations.some((v) => v.field === "version" && v.code === "REMOVED_FIELD"));
});
