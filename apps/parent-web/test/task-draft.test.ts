import assert from "node:assert/strict";
import { test } from "node:test";
import { validateDraft, type Child, type Draft } from "../lib/task-draft.js";

/**
 * Task-builder validation (P1-003).
 *
 * The property worth asserting is the errors/warnings split itself: a
 * warning that starts blocking, or an error that stops blocking, changes
 * what a parent can do — and both are one-character edits away.
 */

const NOW = new Date("2026-06-01T12:00:00.000Z");

const CHILDREN: Child[] = [
  { childId: "child-older", displayName: "Аня", birthYear: 2016 },
  { childId: "child-younger", displayName: "Петя", birthYear: 2021 },
];

function draft(overrides: Partial<Draft> = {}): Draft {
  return {
    title: "Убрать со стола",
    strategy: "PARENT_APPROVAL",
    rewardXp: "10",
    rewardCoins: "0",
    childId: "child-older",
    dueAt: "",
    ...overrides,
  };
}

test("a complete draft has nothing to report", () => {
  const { errors, warnings } = validateDraft(draft(), CHILDREN, NOW);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test("a missing title or audience blocks", () => {
  assert.equal(validateDraft(draft({ title: "   " }), CHILDREN, NOW).errors.length, 1);
  assert.equal(validateDraft(draft({ childId: "" }), CHILDREN, NOW).errors.length, 1);
});

test("a title longer than the contract allows blocks before the server sees it", () => {
  // TaskTemplateSchema caps title at 120. Letting it through would turn
  // a fixable typo into an opaque server error.
  const { errors } = validateDraft(draft({ title: "я".repeat(121) }), CHILDREN, NOW);
  assert.equal(errors.length, 1);
  assert.equal(validateDraft(draft({ title: "я".repeat(120) }), CHILDREN, NOW).errors.length, 0);
});

test("a child who is no longer in the family is refused with something the parent can act on", () => {
  const { errors } = validateDraft(draft({ childId: "child-who-left" }), CHILDREN, NOW);
  assert.equal(errors.length, 1);
  assert.match(errors[0]!, /Обновите/u);
});

test("non-integer or negative rewards block", () => {
  assert.equal(validateDraft(draft({ rewardXp: "3.5" }), CHILDREN, NOW).errors.length, 1);
  assert.equal(validateDraft(draft({ rewardXp: "-1" }), CHILDREN, NOW).errors.length, 1);
  assert.equal(validateDraft(draft({ rewardCoins: "много" }), CHILDREN, NOW).errors.length, 1);
});

test("a due date already in the past blocks", () => {
  // An assignment that is overdue the moment it appears reads to a child
  // as a failure they were never given a chance to avoid.
  const { errors } = validateDraft(draft({ dueAt: "2026-05-01T10:00" }), CHILDREN, NOW);
  assert.equal(errors.length, 1);
  assert.equal(validateDraft(draft({ dueAt: "2026-07-01T10:00" }), CHILDREN, NOW).errors.length, 0);
});

test("a reward-free task warns but does not block", () => {
  const { errors, warnings } = validateDraft(draft({ rewardXp: "0", rewardCoins: "0" }), CHILDREN, NOW);
  // A parent may genuinely want an unrewarded task. Refusing it would be
  // the app overriding them about their own family.
  assert.deepEqual(errors, []);
  assert.equal(warnings.length, 1);
});

test("photo proof warns for a young child and stays quiet for an older one", () => {
  const young = validateDraft(draft({ strategy: "PHOTO_PROOF", childId: "child-younger" }), CHILDREN, NOW);
  assert.deepEqual(young.errors, []);
  assert.equal(young.warnings.length, 1);

  const older = validateDraft(draft({ strategy: "PHOTO_PROOF", childId: "child-older" }), CHILDREN, NOW);
  assert.deepEqual(older.warnings, []);
});

test("problems accumulate rather than reporting only the first", () => {
  // Fixing one field at a time, being told about the next one each time,
  // is the interaction this avoids.
  const { errors } = validateDraft(draft({ title: "", childId: "", rewardXp: "-2" }), CHILDREN, NOW);
  assert.equal(errors.length, 3);
});

test("validation copy contains no Latin-script leakage", () => {
  // Same rule @life/ui-language enforces on UI_STRINGS: these are shown
  // to users verbatim.
  const { errors, warnings } = validateDraft(
    draft({ title: "", childId: "child-who-left", rewardXp: "x", rewardCoins: "x", dueAt: "2026-05-01T10:00" }),
    CHILDREN,
    NOW,
  );
  for (const message of [...errors, ...warnings]) {
    assert.doesNotMatch(message, /[A-Za-z]{2,}/u, `leaks Latin text: ${message}`);
  }
});
