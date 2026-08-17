import assert from "node:assert/strict";
import { test } from "node:test";
import {
  TaskAssignmentSchema,
  TaskCompletionSchema,
  TaskTemplateSchema,
  isValidTaskAssignmentTransition,
} from "../src/task.js";

const FAMILY_ID = "11111111-1111-4111-8111-111111111111";
const PARENT_ID = "22222222-2222-4222-8222-222222222222";
const CHILD_ID = "33333333-3333-4333-8333-333333333333";
const TEMPLATE_ID = "44444444-4444-4444-8444-444444444444";
const ASSIGNMENT_ID = "55555555-5555-4555-8555-555555555555";
const COMPLETION_ID = "66666666-6666-4666-8666-666666666666";

test("a well-formed task template parses", () => {
  const template = TaskTemplateSchema.parse({
    taskTemplateId: TEMPLATE_ID,
    familyId: FAMILY_ID,
    createdByParentId: PARENT_ID,
    title: "Убрать в комнате",
    verificationStrategy: "PHOTO_PROOF",
    rewardXp: 10,
    rewardCoins: 5,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(template.verificationStrategy, "PHOTO_PROOF");
});

test("a task template rejects an unknown verification strategy", () => {
  assert.throws(() =>
    TaskTemplateSchema.parse({
      taskTemplateId: TEMPLATE_ID,
      familyId: FAMILY_ID,
      createdByParentId: PARENT_ID,
      title: "x",
      verificationStrategy: "MAGIC",
      rewardXp: 0,
      rewardCoins: 0,
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    }),
  );
});

test("a task assignment parses", () => {
  const assignment = TaskAssignmentSchema.parse({
    taskAssignmentId: ASSIGNMENT_ID,
    taskTemplateId: TEMPLATE_ID,
    familyId: FAMILY_ID,
    assignedToChildId: CHILD_ID,
    status: "ASSIGNED",
    assignedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(assignment.status, "ASSIGNED");
});

test("task assignment transitions follow ASSIGNED -> IN_PROGRESS -> SUBMITTED -> APPROVED/REJECTED", () => {
  assert.equal(isValidTaskAssignmentTransition("ASSIGNED", "IN_PROGRESS"), true);
  assert.equal(isValidTaskAssignmentTransition("ASSIGNED", "SUBMITTED"), false);
  assert.equal(isValidTaskAssignmentTransition("SUBMITTED", "APPROVED"), true);
  assert.equal(isValidTaskAssignmentTransition("SUBMITTED", "REJECTED"), true);
  assert.equal(isValidTaskAssignmentTransition("APPROVED", "IN_PROGRESS"), false);
  assert.equal(isValidTaskAssignmentTransition("REJECTED", "IN_PROGRESS"), true);
});

test("a task completion parses with only the fields relevant to its evidence type", () => {
  const completion = TaskCompletionSchema.parse({
    taskCompletionId: COMPLETION_ID,
    taskAssignmentId: ASSIGNMENT_ID,
    childId: CHILD_ID,
    submittedAt: "2026-01-01T00:00:00.000Z",
    counterValue: 20,
  });
  assert.equal(completion.counterValue, 20);
  assert.equal(completion.mediaEvidenceId, undefined);
});
