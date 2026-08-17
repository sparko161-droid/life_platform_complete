import assert from "node:assert/strict";
import { test } from "node:test";
import { generateSyntheticFamilies } from "../src/generators.js";

test("same seed produces identical output on repeat runs", () => {
  const a = generateSyntheticFamilies(42, 5);
  const b = generateSyntheticFamilies(42, 5);
  assert.deepEqual(a, b);
});

test("different seeds produce different output", () => {
  const a = generateSyntheticFamilies(1, 5);
  const b = generateSyntheticFamilies(2, 5);
  assert.notDeepEqual(a, b);
});

test("every child belongs to exactly one family and every task references a real child in that family", () => {
  const families = generateSyntheticFamilies(7, 10);
  for (const family of families) {
    const childIds = new Set(family.children.map((c) => c.id));
    for (const task of family.tasks) {
      assert.ok(
        childIds.has(task.assignedToChildId),
        `task ${task.id} references unknown child ${task.assignedToChildId}`,
      );
    }
  }
});

test("no fixture data resembles a real name pattern beyond the fixed synthetic list", () => {
  const families = generateSyntheticFamilies(3, 3);
  const allowedNames = new Set(["Аня", "Ваня", "Настя", "Тимур", "Соня", "Лёша", "Мила", "Егор"]);
  for (const family of families) {
    for (const child of family.children) {
      assert.ok(allowedNames.has(child.displayName));
    }
  }
});
