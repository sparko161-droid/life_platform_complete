import assert from "node:assert/strict";
import { test } from "node:test";
import { FamilySchema, TaskAssignmentSchema, TaskTemplateSchema } from "@life/domain-types";
import { generateSyntheticDomainFamilies } from "../src/domain-generators.js";

test("same seed produces identical output on repeat runs", () => {
  const a = generateSyntheticDomainFamilies(42, 5);
  const b = generateSyntheticDomainFamilies(42, 5);
  assert.deepEqual(a, b);
});

test("different seeds produce different output", () => {
  const a = generateSyntheticDomainFamilies(1, 5);
  const b = generateSyntheticDomainFamilies(2, 5);
  assert.notDeepEqual(a, b);
});

test("every generated family parses against the real FamilySchema", () => {
  const families = generateSyntheticDomainFamilies(7, 10);
  for (const { family } of families) {
    const result = FamilySchema.safeParse(family);
    assert.ok(result.success, JSON.stringify(result.error?.issues));
  }
});

test("every generated template parses against the real TaskTemplateSchema", () => {
  const families = generateSyntheticDomainFamilies(7, 10);
  for (const { templates } of families) {
    for (const t of templates) {
      const result = TaskTemplateSchema.safeParse(t);
      assert.ok(result.success, JSON.stringify(result.error?.issues));
    }
  }
});

test("every generated assignment parses against the real TaskAssignmentSchema", () => {
  const families = generateSyntheticDomainFamilies(7, 10);
  for (const { assignments } of families) {
    for (const a of assignments) {
      const result = TaskAssignmentSchema.safeParse(a);
      assert.ok(result.success, JSON.stringify(result.error?.issues));
    }
  }
});

test("every template and assignment references its own family, and every assignment's child is a real member", () => {
  const families = generateSyntheticDomainFamilies(3, 8);
  for (const { family, templates, assignments } of families) {
    const childIds = new Set(family.children.map((c) => c.childId));
    for (const t of templates) {
      assert.equal(t.familyId, family.familyId);
    }
    for (const a of assignments) {
      assert.equal(a.familyId, family.familyId);
      assert.ok(childIds.has(a.assignedToChildId), `assignment ${a.taskAssignmentId} references unknown child`);
    }
  }
});

test("every family has exactly one owner parent membership", () => {
  const families = generateSyntheticDomainFamilies(11, 6);
  for (const { family } of families) {
    const owners = family.parents.filter((p) => p.isFamilyOwner);
    assert.equal(owners.length, 1);
  }
});
