/**
 * Task repository (P1-025).
 *
 * Unlike family-repository.ts, task-service.ts's functions do NOT take a
 * Family aggregate and do NOT self-enforce actor authorization (by
 * disclosed design -- "enforced by the application layer, not here").
 * Every parent-facing mutation here calls requireActiveParentMemberOrSystem
 * (or requireChildInFamily for assignTask) before touching the domain
 * function -- this is what closes DISC-P1-021-1
 * (packages/security-red-team RT-002, RT-003, RT-016).
 *
 * Child-only actions (startTask, submitTask) rely on the domain layer's
 * own requireAssignedChild check (task-service.ts) -- that one IS
 * enforced there already, since the assignment row itself names its
 * assignee; no separate family-membership check is needed for "is this
 * the right child."
 */
import type { PoolClient } from "pg";
import {
  type ArchiveTemplateCommand,
  type AssignTaskCommand,
  type CreateTemplateCommand,
  type PublishTemplateCommand,
  type StartTaskCommand,
  type SubmitTaskCommand,
  type TaskAssignment,
  type TaskCompletion,
  type TaskTemplate,
  type UpdateTemplateCommand,
  type VerifyTaskCommand,
  archiveTemplate as archiveTemplateDomain,
  assignTask as assignTaskDomain,
  beginVerification as beginVerificationDomain,
  completeTask as completeTaskDomain,
  createTemplate as createTemplateDomain,
  publishTemplate as publishTemplateDomain,
  startTask as startTaskDomain,
  submitTask as submitTaskDomain,
  updateTemplate as updateTemplateDomain,
  verifyTask as verifyTaskDomain,
} from "@life/domain-types";
import { rowToTaskAssignment, rowToTaskCompletion, rowToTaskTemplate } from "../db/rows.js";
import { requireActiveParentMemberOrSystem, requireChildInFamily } from "./auth.js";
import { RepositoryConflictError, RepositoryNotFoundError } from "./errors.js";

async function loadTaskTemplate(client: PoolClient, taskTemplateId: string): Promise<TaskTemplate | null> {
  const { rows } = await client.query(
    "SELECT task_template_id, family_id, created_by_parent_id, title, verification_strategy, reward_xp, reward_coins, status, version, created_at FROM task_templates WHERE task_template_id = $1 FOR UPDATE",
    [taskTemplateId],
  );
  return rows[0] ? rowToTaskTemplate(rows[0]) : null;
}

async function saveTaskTemplate(client: PoolClient, next: TaskTemplate, expectedVersion: number): Promise<void> {
  const result = await client.query(
    `UPDATE task_templates SET title = $1, verification_strategy = $2, reward_xp = $3, reward_coins = $4, status = $5, version = $6
     WHERE task_template_id = $7 AND version = $8`,
    [next.title, next.verificationStrategy, next.rewardXp, next.rewardCoins, next.status, next.version, next.taskTemplateId, expectedVersion],
  );
  if (result.rowCount === 0) throw new RepositoryConflictError("TaskTemplate", next.taskTemplateId);
}

async function loadTaskAssignment(client: PoolClient, taskAssignmentId: string): Promise<TaskAssignment | null> {
  const { rows } = await client.query(
    "SELECT task_assignment_id, task_template_id, family_id, assigned_to_child_id, status, version, assigned_at, due_at FROM task_assignments WHERE task_assignment_id = $1 FOR UPDATE",
    [taskAssignmentId],
  );
  return rows[0] ? rowToTaskAssignment(rows[0]) : null;
}

async function saveTaskAssignment(client: PoolClient, next: TaskAssignment, expectedVersion: number): Promise<void> {
  const result = await client.query(
    "UPDATE task_assignments SET status = $1, version = $2 WHERE task_assignment_id = $3 AND version = $4",
    [next.status, next.version, next.taskAssignmentId, expectedVersion],
  );
  if (result.rowCount === 0) throw new RepositoryConflictError("TaskAssignment", next.taskAssignmentId);
}

export async function createTemplate(client: PoolClient, command: CreateTemplateCommand): Promise<TaskTemplate> {
  await requireActiveParentMemberOrSystem(client, command.familyId, command.createdByParentId);
  const { next } = createTemplateDomain(command);
  await client.query(
    `INSERT INTO task_templates (task_template_id, family_id, created_by_parent_id, title, verification_strategy, reward_xp, reward_coins, status, version, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [next.taskTemplateId, next.familyId, next.createdByParentId, next.title, next.verificationStrategy, next.rewardXp, next.rewardCoins, next.status, next.version, next.createdAt],
  );
  return next;
}

export async function updateTemplate(
  client: PoolClient,
  taskTemplateId: string,
  command: UpdateTemplateCommand,
): Promise<TaskTemplate> {
  const template = await loadTaskTemplate(client, taskTemplateId);
  if (!template) throw new RepositoryNotFoundError("TaskTemplate", taskTemplateId);
  await requireActiveParentMemberOrSystem(client, template.familyId, command.actorId);
  const { next } = updateTemplateDomain(template, command);
  await saveTaskTemplate(client, next, template.version);
  return next;
}

export async function publishTemplate(
  client: PoolClient,
  taskTemplateId: string,
  command: PublishTemplateCommand,
): Promise<TaskTemplate> {
  const template = await loadTaskTemplate(client, taskTemplateId);
  if (!template) throw new RepositoryNotFoundError("TaskTemplate", taskTemplateId);
  await requireActiveParentMemberOrSystem(client, template.familyId, command.actorId);
  const { next } = publishTemplateDomain(template, command);
  await saveTaskTemplate(client, next, template.version);
  return next;
}

export async function archiveTemplate(
  client: PoolClient,
  taskTemplateId: string,
  command: ArchiveTemplateCommand,
): Promise<TaskTemplate> {
  const template = await loadTaskTemplate(client, taskTemplateId);
  if (!template) throw new RepositoryNotFoundError("TaskTemplate", taskTemplateId);
  await requireActiveParentMemberOrSystem(client, template.familyId, command.actorId);
  const { next } = archiveTemplateDomain(template, command);
  await saveTaskTemplate(client, next, template.version);
  return next;
}

export async function assignTask(
  client: PoolClient,
  taskTemplateId: string,
  command: AssignTaskCommand,
): Promise<TaskAssignment> {
  const template = await loadTaskTemplate(client, taskTemplateId);
  if (!template) throw new RepositoryNotFoundError("TaskTemplate", taskTemplateId);
  await requireActiveParentMemberOrSystem(client, template.familyId, command.actorId);
  // Closes RT-016: assignTask's own docstring discloses this as an
  // application-layer responsibility.
  await requireChildInFamily(client, template.familyId, command.assignedToChildId);

  const { next } = assignTaskDomain(template, command);
  await client.query(
    `INSERT INTO task_assignments (task_assignment_id, task_template_id, family_id, assigned_to_child_id, status, version, assigned_at, due_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [next.taskAssignmentId, next.taskTemplateId, next.familyId, next.assignedToChildId, next.status, next.version, next.assignedAt, next.dueAt ?? null],
  );
  return next;
}

export async function startTask(
  client: PoolClient,
  taskAssignmentId: string,
  command: StartTaskCommand,
): Promise<TaskAssignment> {
  const assignment = await loadTaskAssignment(client, taskAssignmentId);
  if (!assignment) throw new RepositoryNotFoundError("TaskAssignment", taskAssignmentId);
  // Child-only: enforced by task-service.ts's own requireAssignedChild.
  const { next } = startTaskDomain(assignment, command);
  await saveTaskAssignment(client, next, assignment.version);
  return next;
}

export async function submitTask(
  client: PoolClient,
  taskAssignmentId: string,
  command: SubmitTaskCommand,
): Promise<{ assignment: TaskAssignment; completion: TaskCompletion }> {
  const assignment = await loadTaskAssignment(client, taskAssignmentId);
  if (!assignment) throw new RepositoryNotFoundError("TaskAssignment", taskAssignmentId);
  // Child-only: enforced by task-service.ts's own requireAssignedChild.
  const { next } = submitTaskDomain(assignment, command);
  await saveTaskAssignment(client, next.assignment, assignment.version);
  await client.query(
    `INSERT INTO task_completions (task_completion_id, task_assignment_id, child_id, submitted_at, media_evidence_id, counter_value, timer_seconds, self_report_note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      next.completion.taskCompletionId,
      next.completion.taskAssignmentId,
      next.completion.childId,
      next.completion.submittedAt,
      next.completion.mediaEvidenceId ?? null,
      next.completion.counterValue ?? null,
      next.completion.timerSeconds ?? null,
      next.completion.selfReportNote ?? null,
    ],
  );
  return next;
}

export async function beginVerification(
  client: PoolClient,
  taskAssignmentId: string,
  actorId: string,
  now: string,
): Promise<TaskAssignment> {
  const assignment = await loadTaskAssignment(client, taskAssignmentId);
  if (!assignment) throw new RepositoryNotFoundError("TaskAssignment", taskAssignmentId);
  await requireActiveParentMemberOrSystem(client, assignment.familyId, actorId);
  const { next } = beginVerificationDomain(assignment, actorId, now);
  await saveTaskAssignment(client, next, assignment.version);
  return next;
}

export async function verifyTask(
  client: PoolClient,
  taskAssignmentId: string,
  command: VerifyTaskCommand,
): Promise<TaskAssignment> {
  const assignment = await loadTaskAssignment(client, taskAssignmentId);
  if (!assignment) throw new RepositoryNotFoundError("TaskAssignment", taskAssignmentId);
  // Closes RT-002 (arbitrary non-member actor) and RT-003 (a child
  // self-approving their own task -- a child's id is never a row in
  // parent_memberships, so it fails this check the same way).
  await requireActiveParentMemberOrSystem(client, assignment.familyId, command.actorId);
  const { next } = verifyTaskDomain(assignment, command);
  await saveTaskAssignment(client, next, assignment.version);
  return next;
}

export async function completeTask(
  client: PoolClient,
  taskAssignmentId: string,
  actorId: string,
  now: string,
): Promise<TaskAssignment> {
  const assignment = await loadTaskAssignment(client, taskAssignmentId);
  if (!assignment) throw new RepositoryNotFoundError("TaskAssignment", taskAssignmentId);
  await requireActiveParentMemberOrSystem(client, assignment.familyId, actorId);
  const { next } = completeTaskDomain(assignment, actorId, now);
  await saveTaskAssignment(client, next, assignment.version);
  return next;
}

/**
 * Reads a task completion by its own id -- e.g. for
 * `/task-assignments/{id}/completions` (P1-026). Read-only, no
 * `FOR UPDATE`: completions are immutable append-only records
 * (task.ts's own docstring), never edited in place.
 */
export async function getTaskCompletion(client: PoolClient, taskCompletionId: string): Promise<TaskCompletion | null> {
  const { rows } = await client.query(
    "SELECT task_completion_id, task_assignment_id, child_id, submitted_at, media_evidence_id, counter_value, timer_seconds, self_report_note FROM task_completions WHERE task_completion_id = $1",
    [taskCompletionId],
  );
  return rows[0] ? rowToTaskCompletion(rows[0]) : null;
}

export { loadTaskAssignment, loadTaskTemplate };
