/**
 * Tests for the task template and lifecycle domain service (P1-002A).
 *
 * Strategy per task-registry (test_strategy: "State-machine unit tests,
 * integration tests and unauthorized mutation tests."):
 *   - Template: create, update (field validation), publish, archive
 *   - Assignment: assign, start, submit, verify (approve/reject), complete
 *   - State machine: invalid transitions rejected
 *   - Unauthorized: wrong child for child-only actions
 *   - Audit evidence: every mutation emitting events has correct shape
 *   - Integration: full task lifecycle in one flow
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  TaskDomainError,
  archiveTemplate,
  assignTask,
  beginVerification,
  completeTask,
  createTemplate,
  publishTemplate,
  startTask,
  submitTask,
  updateTemplate,
  verifyTask,
} from "../src/task-service.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FAMILY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as const;
const PARENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" as const;
const OTHER_PARENT_ID = "99999999-9999-4999-8999-999999999999" as const;
const CHILD_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc" as const;
const OTHER_CHILD_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd" as const;
const TEMPLATE_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" as const;
const ASSIGNMENT_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff" as const;
const COMPLETION_ID = "11111111-1111-4111-8111-111111111111" as const;
const T0 = "2026-01-01T00:00:00.000Z";
const T1 = "2026-01-01T01:00:00.000Z";
const T2 = "2026-01-01T02:00:00.000Z";
const T3 = "2026-01-01T03:00:00.000Z";
const T4 = "2026-01-01T04:00:00.000Z";
const T5 = "2026-01-01T05:00:00.000Z";

function makeDraftTemplate() {
  return createTemplate({
    taskTemplateId: TEMPLATE_ID as any,
    familyId: FAMILY_ID as any,
    createdByParentId: PARENT_ID as any,
    title: "Убрать комнату",
    verificationStrategy: "PARENT_APPROVAL",
    rewardXp: 10,
    rewardCoins: 5,
    now: T0,
  }).next;
}

function makeActiveTemplate() {
  const draft = makeDraftTemplate();
  return publishTemplate(draft, { actorId: PARENT_ID as any, now: T0 }).next;
}

function makeAssignment() {
  const template = makeActiveTemplate();
  return assignTask(template, {
    taskAssignmentId: ASSIGNMENT_ID as any,
    assignedToChildId: CHILD_ID as any,
    actorId: PARENT_ID as any,
    now: T1,
  }).next;
}

// ---------------------------------------------------------------------------
// createTemplate
// ---------------------------------------------------------------------------

test("createTemplate: creates a DRAFT template with version 1", () => {
  const { next: template, events } = createTemplate({
    taskTemplateId: TEMPLATE_ID as any,
    familyId: FAMILY_ID as any,
    createdByParentId: PARENT_ID as any,
    title: "Убрать комнату",
    verificationStrategy: "PARENT_APPROVAL",
    rewardXp: 10,
    rewardCoins: 5,
    now: T0,
  });

  assert.equal(template.status, "DRAFT");
  assert.equal(template.version, 1);
  assert.equal(template.title, "Убрать комнату");
  assert.equal(template.verificationStrategy, "PARENT_APPROVAL");
  assert.equal(template.rewardXp, 10);
  assert.equal(template.rewardCoins, 5);

  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, "TASK_TEMPLATE_CREATED");
  assert.equal(events[0].familyId, FAMILY_ID);
});

test("createTemplate: rejects blank title", () => {
  assert.throws(
    () =>
      createTemplate({
        taskTemplateId: TEMPLATE_ID as any,
        familyId: FAMILY_ID as any,
        createdByParentId: PARENT_ID as any,
        title: "   ",
        verificationStrategy: "PARENT_APPROVAL",
        rewardXp: 10,
        rewardCoins: 5,
        now: T0,
      }),
    (err: unknown) => err instanceof TaskDomainError && err.code === "CREATE_TEMPLATE_EMPTY_TITLE",
  );
});

test("createTemplate: rejects negative reward values", () => {
  assert.throws(
    () =>
      createTemplate({
        taskTemplateId: TEMPLATE_ID as any,
        familyId: FAMILY_ID as any,
        createdByParentId: PARENT_ID as any,
        title: "Test",
        verificationStrategy: "PARENT_APPROVAL",
        rewardXp: -1,
        rewardCoins: 5,
        now: T0,
      }),
    (err: unknown) => err instanceof TaskDomainError && err.code === "CREATE_TEMPLATE_NEGATIVE_REWARD",
  );
});

// ---------------------------------------------------------------------------
// updateTemplate
// ---------------------------------------------------------------------------

test("updateTemplate: updates fields on a DRAFT template", () => {
  const template = makeDraftTemplate();
  const { next, events } = updateTemplate(template, {
    actorId: PARENT_ID as any,
    title: "Помыть посуду",
    rewardXp: 20,
    now: T1,
  });

  assert.equal(next.title, "Помыть посуду");
  assert.equal(next.rewardXp, 20);
  assert.equal(next.rewardCoins, 5); // unchanged
  assert.equal(next.version, 2);
  assert.equal(events.length, 0); // no events for draft edits
});

test("updateTemplate: rejects update on a non-DRAFT template", () => {
  const active = makeActiveTemplate();
  assert.throws(
    () => updateTemplate(active, { actorId: PARENT_ID as any, title: "New title", now: T1 }),
    (err: unknown) => err instanceof TaskDomainError && err.code === "UPDATE_TEMPLATE_NOT_DRAFT",
  );
});

test("updateTemplate: rejects blank title update", () => {
  const template = makeDraftTemplate();
  assert.throws(
    () => updateTemplate(template, { actorId: PARENT_ID as any, title: "", now: T1 }),
    (err: unknown) => err instanceof TaskDomainError && err.code === "UPDATE_TEMPLATE_EMPTY_TITLE",
  );
});

// ---------------------------------------------------------------------------
// publishTemplate
// ---------------------------------------------------------------------------

test("publishTemplate: moves DRAFT to ACTIVE", () => {
  const template = makeDraftTemplate();
  const { next, events } = publishTemplate(template, { actorId: PARENT_ID as any, now: T1 });

  assert.equal(next.status, "ACTIVE");
  assert.equal(next.version, 2);
  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, "TASK_TEMPLATE_PUBLISHED");
});

test("publishTemplate: cannot publish an already ACTIVE template", () => {
  const active = makeActiveTemplate();
  assert.throws(
    () => publishTemplate(active, { actorId: PARENT_ID as any, now: T1 }),
    (err: unknown) => err instanceof TaskDomainError && err.code === "PUBLISH_TEMPLATE_INVALID_TRANSITION",
  );
});

// ---------------------------------------------------------------------------
// archiveTemplate
// ---------------------------------------------------------------------------

test("archiveTemplate: moves ACTIVE to ARCHIVED", () => {
  const active = makeActiveTemplate();
  const { next, events } = archiveTemplate(active, { actorId: PARENT_ID as any, now: T1 });

  assert.equal(next.status, "ARCHIVED");
  assert.equal(next.version, 3); // createTemplate v1, publish v2, archive v3
  assert.equal(events.length, 0);
});

test("archiveTemplate: cannot archive an already-ARCHIVED template", () => {
  const active = makeActiveTemplate();
  const { next: archived } = archiveTemplate(active, { actorId: PARENT_ID as any, now: T1 });
  // ARCHIVED is terminal
  assert.throws(
    () => archiveTemplate(archived, { actorId: PARENT_ID as any, now: T2 }),
    (err: unknown) => err instanceof TaskDomainError && err.code === "ARCHIVE_TEMPLATE_INVALID_TRANSITION",
  );
});

// ---------------------------------------------------------------------------
// assignTask
// ---------------------------------------------------------------------------

test("assignTask: assigns a child to an ACTIVE template", () => {
  const template = makeActiveTemplate();
  const { next: assignment, events } = assignTask(template, {
    taskAssignmentId: ASSIGNMENT_ID as any,
    assignedToChildId: CHILD_ID as any,
    actorId: PARENT_ID as any,
    dueAt: "2026-01-08T00:00:00.000Z",
    now: T1,
  });

  assert.equal(assignment.status, "ASSIGNED");
  assert.equal(assignment.version, 1);
  assert.equal(assignment.assignedToChildId, CHILD_ID);
  assert.equal(assignment.dueAt, "2026-01-08T00:00:00.000Z");

  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, "TASK_ASSIGNED");
  assert.equal(events[0].childId, CHILD_ID);
});

test("assignTask: cannot assign from a non-ACTIVE template", () => {
  const draft = makeDraftTemplate();
  assert.throws(
    () =>
      assignTask(draft, {
        taskAssignmentId: ASSIGNMENT_ID as any,
        assignedToChildId: CHILD_ID as any,
        actorId: PARENT_ID as any,
        now: T1,
      }),
    (err: unknown) => err instanceof TaskDomainError && err.code === "ASSIGN_TASK_TEMPLATE_NOT_ACTIVE",
  );
});

// ---------------------------------------------------------------------------
// startTask
// ---------------------------------------------------------------------------

test("startTask: child starts their assigned task", () => {
  const assignment = makeAssignment();
  const { next, events } = startTask(assignment, { actorId: CHILD_ID as any, now: T2 });

  assert.equal(next.status, "IN_PROGRESS");
  assert.equal(next.version, 2);
  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, "TASK_STARTED");
  assert.equal(events[0].childId, CHILD_ID);
});

test("startTask: wrong child is rejected", () => {
  const assignment = makeAssignment();
  assert.throws(
    () => startTask(assignment, { actorId: OTHER_CHILD_ID as any, now: T2 }),
    (err: unknown) => err instanceof TaskDomainError && err.code === "START_TASK_WRONG_CHILD",
  );
});

test("startTask: cannot start an already in-progress task", () => {
  const assignment = makeAssignment();
  const { next: inProgress } = startTask(assignment, { actorId: CHILD_ID as any, now: T2 });
  assert.throws(
    () => startTask(inProgress, { actorId: CHILD_ID as any, now: T3 }),
    (err: unknown) => err instanceof TaskDomainError && err.code === "START_TASK_WRONG_STATUS",
  );
});

// ---------------------------------------------------------------------------
// submitTask
// ---------------------------------------------------------------------------

test("submitTask: child submits a task and a completion record is created", () => {
  const assignment = makeAssignment();
  const { next: inProgress } = startTask(assignment, { actorId: CHILD_ID as any, now: T2 });

  const { next, events } = submitTask(inProgress, {
    taskCompletionId: COMPLETION_ID as any,
    actorId: CHILD_ID as any,
    selfReportNote: "Всё убрал!",
    now: T3,
  });

  assert.equal(next.assignment.status, "SUBMITTED");
  assert.equal(next.completion.taskCompletionId, COMPLETION_ID);
  assert.equal(next.completion.selfReportNote, "Всё убрал!");
  assert.equal(next.completion.submittedAt, T3);

  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, "TASK_SUBMITTED");
  assert.equal(events[0].childId, CHILD_ID);
});

test("submitTask: wrong child is rejected", () => {
  const assignment = makeAssignment();
  const { next: inProgress } = startTask(assignment, { actorId: CHILD_ID as any, now: T2 });
  assert.throws(
    () =>
      submitTask(inProgress, {
        taskCompletionId: COMPLETION_ID as any,
        actorId: OTHER_CHILD_ID as any,
        now: T3,
      }),
    (err: unknown) => err instanceof TaskDomainError && err.code === "SUBMIT_TASK_WRONG_CHILD",
  );
});

// ---------------------------------------------------------------------------
// verifyTask / beginVerification
// ---------------------------------------------------------------------------

test("verifyTask: parent approves a task", () => {
  const assignment = makeAssignment();
  const { next: inProgress } = startTask(assignment, { actorId: CHILD_ID as any, now: T2 });
  const { next: submitted } = submitTask(inProgress, {
    taskCompletionId: COMPLETION_ID as any,
    actorId: CHILD_ID as any,
    now: T3,
  });
  const { next: verifying } = beginVerification(submitted.assignment, PARENT_ID, T3);

  const { next: verified, events } = verifyTask(verifying, {
    actorId: PARENT_ID,
    outcome: "APPROVED",
    now: T4,
  });

  assert.equal(verified.status, "APPROVED");
  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, "TASK_APPROVED");
});

test("verifyTask: parent rejects a task", () => {
  const assignment = makeAssignment();
  const { next: inProgress } = startTask(assignment, { actorId: CHILD_ID as any, now: T2 });
  const { next: submitted } = submitTask(inProgress, {
    taskCompletionId: COMPLETION_ID as any,
    actorId: CHILD_ID as any,
    now: T3,
  });
  const { next: verifying } = beginVerification(submitted.assignment, PARENT_ID, T3);

  const { next: rejected, events } = verifyTask(verifying, {
    actorId: PARENT_ID,
    outcome: "REJECTED",
    now: T4,
  });

  assert.equal(rejected.status, "REJECTED");
  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, "TASK_REJECTED");
});

test("verifyTask: system (Verification Engine) can approve", () => {
  const assignment = makeAssignment();
  const { next: inProgress } = startTask(assignment, { actorId: CHILD_ID as any, now: T2 });
  const { next: submitted } = submitTask(inProgress, {
    taskCompletionId: COMPLETION_ID as any,
    actorId: CHILD_ID as any,
    now: T3,
  });
  const { next: verifying } = beginVerification(submitted.assignment, "system", T3);

  const { next, events } = verifyTask(verifying, {
    actorId: "system",
    outcome: "APPROVED",
    now: T4,
  });

  assert.equal(next.status, "APPROVED");
  assert.equal(events[0].actorId, "system");
});

// ---------------------------------------------------------------------------
// completeTask
// ---------------------------------------------------------------------------

test("completeTask: moves APPROVED to COMPLETED", () => {
  const assignment = makeAssignment();
  const { next: inProgress } = startTask(assignment, { actorId: CHILD_ID as any, now: T2 });
  const { next: submitted } = submitTask(inProgress, {
    taskCompletionId: COMPLETION_ID as any,
    actorId: CHILD_ID as any,
    now: T3,
  });
  const { next: verifying } = beginVerification(submitted.assignment, PARENT_ID, T3);
  const { next: approved } = verifyTask(verifying, {
    actorId: PARENT_ID,
    outcome: "APPROVED",
    now: T4,
  });

  const { next: completed, events } = completeTask(approved, "system", T5);

  assert.equal(completed.status, "COMPLETED");
  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, "TASK_COMPLETED");
});

test("completeTask: cannot complete a non-APPROVED task", () => {
  const assignment = makeAssignment();
  assert.throws(
    () => completeTask(assignment, "system", T1),
    (err: unknown) => err instanceof TaskDomainError && err.code === "COMPLETE_TASK_INVALID_TRANSITION",
  );
});

// ---------------------------------------------------------------------------
// Retry flow: REJECTED -> IN_PROGRESS
// ---------------------------------------------------------------------------

test("retry flow: child can retry after rejection", () => {
  const assignment = makeAssignment();
  const { next: inProgress } = startTask(assignment, { actorId: CHILD_ID as any, now: T1 });
  const { next: submitted } = submitTask(inProgress, {
    taskCompletionId: COMPLETION_ID as any,
    actorId: CHILD_ID as any,
    now: T2,
  });
  const { next: verifying } = beginVerification(submitted.assignment, PARENT_ID, T2);
  const { next: rejected } = verifyTask(verifying, {
    actorId: PARENT_ID,
    outcome: "REJECTED",
    now: T3,
  });

  // After rejection, the task returns to IN_PROGRESS for another attempt
  assert.equal(rejected.status, "REJECTED");

  // Start again (REJECTED -> IN_PROGRESS uses the same startTask function,
  // but the transition table says REJECTED -> IN_PROGRESS is valid via
  // isValidTaskAssignmentTransition)
  const { next: retried } = startTask(rejected, { actorId: CHILD_ID as any, now: T4 });
  assert.equal(retried.status, "IN_PROGRESS");
});

// ---------------------------------------------------------------------------
// Full lifecycle integration
// ---------------------------------------------------------------------------

test("full task lifecycle: template creation -> assign -> work -> approve -> complete", () => {
  // 1. Create and publish template
  const { next: draft } = createTemplate({
    taskTemplateId: TEMPLATE_ID as any,
    familyId: FAMILY_ID as any,
    createdByParentId: PARENT_ID as any,
    title: "Убрать комнату",
    verificationStrategy: "PARENT_APPROVAL",
    rewardXp: 10,
    rewardCoins: 5,
    now: T0,
  });
  assert.equal(draft.status, "DRAFT");

  const { next: updated } = updateTemplate(draft, {
    actorId: PARENT_ID as any,
    rewardXp: 15,
    now: T0,
  });
  assert.equal(updated.rewardXp, 15);

  const { next: template } = publishTemplate(updated, { actorId: PARENT_ID as any, now: T0 });
  assert.equal(template.status, "ACTIVE");

  // 2. Assign to child
  const { next: assignment } = assignTask(template, {
    taskAssignmentId: ASSIGNMENT_ID as any,
    assignedToChildId: CHILD_ID as any,
    actorId: PARENT_ID as any,
    now: T1,
  });
  assert.equal(assignment.status, "ASSIGNED");

  // 3. Child starts
  const { next: inProgress } = startTask(assignment, { actorId: CHILD_ID as any, now: T2 });
  assert.equal(inProgress.status, "IN_PROGRESS");

  // 4. Child submits
  const { next: submittedResult } = submitTask(inProgress, {
    taskCompletionId: COMPLETION_ID as any,
    actorId: CHILD_ID as any,
    selfReportNote: "Готово!",
    now: T3,
  });
  assert.equal(submittedResult.assignment.status, "SUBMITTED");

  // 5. Enter verification
  const { next: verifying } = beginVerification(submittedResult.assignment, PARENT_ID, T3);
  assert.equal(verifying.status, "VERIFYING");

  // 6. Parent approves
  const { next: approved } = verifyTask(verifying, {
    actorId: PARENT_ID,
    outcome: "APPROVED",
    now: T4,
  });
  assert.equal(approved.status, "APPROVED");

  // 7. System marks complete (after reward granted)
  const { next: completed } = completeTask(approved, "system", T5);
  assert.equal(completed.status, "COMPLETED");
  // version 1 (ASSIGNED) -> 2 (IN_PROGRESS) -> 3 (SUBMITTED) ->
  // 4 (VERIFYING) -> 5 (APPROVED) -> 6 (COMPLETED)
  assert.equal(completed.version, 6);
});
