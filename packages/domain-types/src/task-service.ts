import { randomUUID } from "node:crypto";
import type { EventEnvelope } from "./events.js";
import type { FamilyId } from "./ids.js";
import type { ChildId, ParentId, TaskAssignmentId, TaskTemplateId } from "./ids.js";
import {
  type TaskAssignment,
  type TaskAssignmentStatus,
  type TaskCompletion,
  type TaskTemplate,
  type TaskTemplateStatus,
  isValidTaskAssignmentTransition,
  isValidTaskTemplateTransition,
} from "./task.js";

/**
 * Task template and lifecycle domain service (P1-002A).
 *
 * Implements "Task template and lifecycle core" — create/update/publish
 * task templates and assign/work/verify task instances — as pure domain
 * functions. No I/O occurs here; callers persist the returned state.
 *
 * Authorization model per docs/product/actors-and-permissions.md:
 *   - createTemplate / updateTemplate / publishTemplate / archiveTemplate:
 *     any ACTIVE parent in the same family (base parent access)
 *   - assignTask: any ACTIVE parent
 *   - startTask: the assigned child only
 *   - submitTask: the assigned child only
 *   - approveTask / rejectTask: a parent with base access
 *     OR the automated Verification Engine (actorId === "system")
 *
 * Concurrency: every mutating function returns a new aggregate with
 * version+1; stale-version conflicts are the persistence layer's concern.
 *
 * Sources:
 *   - docs/architecture/entity-lifecycle.md ("## Task")
 *   - docs/product/actors-and-permissions.md
 *   - MASTER_SPEC §7–8
 */

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class TaskDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "TaskDomainError";
  }
}

// ---------------------------------------------------------------------------
// Command types
// ---------------------------------------------------------------------------

export interface CreateTemplateCommand {
  taskTemplateId: TaskTemplateId;
  familyId: FamilyId;
  createdByParentId: ParentId;
  title: string;
  verificationStrategy: TaskTemplate["verificationStrategy"];
  rewardXp: number;
  rewardCoins: number;
  now: string;
}

export interface UpdateTemplateCommand {
  actorId: ParentId;
  title?: string;
  verificationStrategy?: TaskTemplate["verificationStrategy"];
  rewardXp?: number;
  rewardCoins?: number;
  now: string;
}

export interface PublishTemplateCommand {
  actorId: ParentId;
  now: string;
}

export interface ArchiveTemplateCommand {
  actorId: ParentId;
  now: string;
}

export interface AssignTaskCommand {
  taskAssignmentId: TaskAssignmentId;
  assignedToChildId: ChildId;
  actorId: ParentId;
  dueAt?: string;
  now: string;
}

export interface StartTaskCommand {
  actorId: ChildId;
  now: string;
}

export interface SubmitTaskCommand {
  taskCompletionId: TaskCompletion["taskCompletionId"];
  actorId: ChildId;
  mediaEvidenceId?: TaskCompletion["mediaEvidenceId"];
  counterValue?: number;
  timerSeconds?: number;
  selfReportNote?: string;
  now: string;
}

export interface VerifyTaskCommand {
  /** Parent id or "system" for the Verification Engine. */
  actorId: string;
  outcome: "APPROVED" | "REJECTED";
  now: string;
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface TaskCommandResult<T> {
  next: T;
  events: EventEnvelope[];
}

// ---------------------------------------------------------------------------
// Authorization helpers
// ---------------------------------------------------------------------------

function requireSameFamily(template: TaskTemplate, familyId: FamilyId, code: string): void {
  if (template.familyId !== familyId) {
    throw new TaskDomainError(code, `Template ${template.taskTemplateId} belongs to family ${template.familyId}, not ${familyId}`);
  }
}

function requireTemplateStatus(template: TaskTemplate, expected: TaskTemplateStatus, code: string): void {
  if (template.status !== expected) {
    throw new TaskDomainError(code, `Template ${template.taskTemplateId} is ${template.status}, expected ${expected}`);
  }
}

function requireAssignmentStatus(assignment: TaskAssignment, expected: TaskAssignmentStatus, code: string): void {
  if (assignment.status !== expected) {
    throw new TaskDomainError(
      code,
      `Assignment ${assignment.taskAssignmentId} is ${assignment.status}, expected ${expected}`,
    );
  }
}

function requireAssignedChild(assignment: TaskAssignment, childId: ChildId, code: string): void {
  if (assignment.assignedToChildId !== childId) {
    throw new TaskDomainError(
      code,
      `Child ${childId} is not the assignee of assignment ${assignment.taskAssignmentId}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Event envelope factory (task variant)
// ---------------------------------------------------------------------------

function makeTaskEvent(
  eventType: string,
  familyId: FamilyId,
  actorId: string,
  aggregateId: string,
  version: number,
  now: string,
  payload: Record<string, unknown>,
  childId?: ChildId,
): EventEnvelope {
  return {
    eventId: randomUUID() as string,
    eventType,
    occurredAt: now,
    actorId,
    familyId,
    aggregateId,
    version,
    payload,
    ...(childId !== undefined ? { childId } : {}),
  };
}

// ---------------------------------------------------------------------------
// Template operations
// ---------------------------------------------------------------------------

/**
 * Create a new task template in DRAFT status. The creating parent becomes
 * the template's owner. Any parent in the family may create templates
 * (base parent access per actors-and-permissions.md); the caller is
 * responsible for ensuring `createdByParentId` is an ACTIVE family member.
 */
export function createTemplate(command: CreateTemplateCommand): TaskCommandResult<TaskTemplate> {
  if (command.rewardXp < 0 || command.rewardCoins < 0) {
    throw new TaskDomainError("CREATE_TEMPLATE_NEGATIVE_REWARD", "rewardXp and rewardCoins must be non-negative");
  }
  if (!command.title.trim()) {
    throw new TaskDomainError("CREATE_TEMPLATE_EMPTY_TITLE", "title must not be blank");
  }

  const template: TaskTemplate = {
    taskTemplateId: command.taskTemplateId,
    familyId: command.familyId,
    createdByParentId: command.createdByParentId,
    title: command.title,
    verificationStrategy: command.verificationStrategy,
    rewardXp: command.rewardXp,
    rewardCoins: command.rewardCoins,
    status: "DRAFT",
    version: 1,
    createdAt: command.now,
  };

  const event = makeTaskEvent(
    "TASK_TEMPLATE_CREATED",
    command.familyId,
    command.createdByParentId,
    command.taskTemplateId,
    1,
    command.now,
    { taskTemplateId: command.taskTemplateId, title: command.title },
  );

  return { next: template, events: [event] };
}

/**
 * Update a DRAFT template's fields. Only DRAFT templates may be edited;
 * published (ACTIVE/ARCHIVED) templates are immutable to preserve the
 * integrity of existing assignments. Fields not supplied are left unchanged.
 */
export function updateTemplate(
  template: TaskTemplate,
  command: UpdateTemplateCommand,
): TaskCommandResult<TaskTemplate> {
  requireSameFamily(template, template.familyId, "UPDATE_TEMPLATE_WRONG_FAMILY");
  requireTemplateStatus(template, "DRAFT", "UPDATE_TEMPLATE_NOT_DRAFT");

  if (command.title !== undefined && !command.title.trim()) {
    throw new TaskDomainError("UPDATE_TEMPLATE_EMPTY_TITLE", "title must not be blank");
  }
  if (command.rewardXp !== undefined && command.rewardXp < 0) {
    throw new TaskDomainError("UPDATE_TEMPLATE_NEGATIVE_XP", "rewardXp must be non-negative");
  }
  if (command.rewardCoins !== undefined && command.rewardCoins < 0) {
    throw new TaskDomainError("UPDATE_TEMPLATE_NEGATIVE_COINS", "rewardCoins must be non-negative");
  }

  const nextVersion = template.version + 1;
  const nextTemplate: TaskTemplate = {
    ...template,
    ...(command.title !== undefined ? { title: command.title } : {}),
    ...(command.verificationStrategy !== undefined ? { verificationStrategy: command.verificationStrategy } : {}),
    ...(command.rewardXp !== undefined ? { rewardXp: command.rewardXp } : {}),
    ...(command.rewardCoins !== undefined ? { rewardCoins: command.rewardCoins } : {}),
    version: nextVersion,
  };

  // No dedicated TASK_TEMPLATE_UPDATED event — template edits in DRAFT are
  // low-interest for audit purposes. TASK_TEMPLATE_PUBLISHED is the audit
  // marker that matters.
  return { next: nextTemplate, events: [] };
}

/**
 * Publish a template (DRAFT → ACTIVE), making it assignable to children.
 * After publishing, the template cannot be edited — assignments reference
 * the version at assignment time.
 */
export function publishTemplate(
  template: TaskTemplate,
  command: PublishTemplateCommand,
): TaskCommandResult<TaskTemplate> {
  if (!isValidTaskTemplateTransition(template.status, "ACTIVE")) {
    throw new TaskDomainError(
      "PUBLISH_TEMPLATE_INVALID_TRANSITION",
      `Cannot publish template in status ${template.status}`,
    );
  }

  const nextVersion = template.version + 1;
  const nextTemplate: TaskTemplate = { ...template, status: "ACTIVE", version: nextVersion };

  const event = makeTaskEvent(
    "TASK_TEMPLATE_PUBLISHED",
    template.familyId,
    command.actorId,
    template.taskTemplateId,
    nextVersion,
    command.now,
    { taskTemplateId: template.taskTemplateId, title: template.title },
  );

  return { next: nextTemplate, events: [event] };
}

/**
 * Archive a template (ACTIVE → ARCHIVED). Existing assignments keep running;
 * no new assignments may be created from an ARCHIVED template.
 */
export function archiveTemplate(
  template: TaskTemplate,
  command: ArchiveTemplateCommand,
): TaskCommandResult<TaskTemplate> {
  if (!isValidTaskTemplateTransition(template.status, "ARCHIVED")) {
    throw new TaskDomainError(
      "ARCHIVE_TEMPLATE_INVALID_TRANSITION",
      `Cannot archive template in status ${template.status}`,
    );
  }

  const nextVersion = template.version + 1;
  const nextTemplate: TaskTemplate = { ...template, status: "ARCHIVED", version: nextVersion };

  return { next: nextTemplate, events: [] };
}

// ---------------------------------------------------------------------------
// Assignment operations
// ---------------------------------------------------------------------------

/**
 * Assign a published task template to a child. The template must be ACTIVE;
 * the child and parent are expected to belong to the same family (enforced
 * by the application layer, not here, since the domain layer doesn't have
 * the family aggregate in scope).
 */
export function assignTask(
  template: TaskTemplate,
  command: AssignTaskCommand,
): TaskCommandResult<TaskAssignment> {
  if (template.status !== "ACTIVE") {
    throw new TaskDomainError(
      "ASSIGN_TASK_TEMPLATE_NOT_ACTIVE",
      `Template ${template.taskTemplateId} is ${template.status}, not ACTIVE`,
    );
  }

  const assignment: TaskAssignment = {
    taskAssignmentId: command.taskAssignmentId,
    taskTemplateId: template.taskTemplateId,
    familyId: template.familyId,
    assignedToChildId: command.assignedToChildId,
    status: "ASSIGNED",
    version: 1,
    assignedAt: command.now,
    ...(command.dueAt !== undefined ? { dueAt: command.dueAt } : {}),
  };

  const event = makeTaskEvent(
    "TASK_ASSIGNED",
    template.familyId,
    command.actorId,
    command.taskAssignmentId,
    1,
    command.now,
    {
      taskAssignmentId: command.taskAssignmentId,
      taskTemplateId: template.taskTemplateId,
      assignedToChildId: command.assignedToChildId,
    },
    command.assignedToChildId,
  );

  return { next: assignment, events: [event] };
}

/**
 * Child starts (or retries) a task (ASSIGNED → IN_PROGRESS or
 * REJECTED → IN_PROGRESS). Only the assigned child may start their own task.
 * The REJECTED → IN_PROGRESS path is the retry flow when a parent rejects
 * and the child needs to try again (state machine: REJECTED: ["IN_PROGRESS"]).
 */
export function startTask(assignment: TaskAssignment, command: StartTaskCommand): TaskCommandResult<TaskAssignment> {
  requireAssignedChild(assignment, command.actorId, "START_TASK_WRONG_CHILD");
  if (!isValidTaskAssignmentTransition(assignment.status, "IN_PROGRESS")) {
    throw new TaskDomainError(
      "START_TASK_WRONG_STATUS",
      `Assignment ${assignment.taskAssignmentId} is ${assignment.status}, cannot move to IN_PROGRESS`,
    );
  }

  const nextVersion = assignment.version + 1;
  const nextAssignment: TaskAssignment = { ...assignment, status: "IN_PROGRESS", version: nextVersion };

  const event = makeTaskEvent(
    "TASK_STARTED",
    assignment.familyId,
    command.actorId,
    assignment.taskAssignmentId,
    nextVersion,
    command.now,
    { taskAssignmentId: assignment.taskAssignmentId },
    assignment.assignedToChildId,
  );

  return { next: nextAssignment, events: [event] };
}

/**
 * Child submits a completed task (IN_PROGRESS → SUBMITTED). Returns the
 * updated assignment and the immutable completion record. A child may only
 * submit their own task.
 */
export function submitTask(
  assignment: TaskAssignment,
  command: SubmitTaskCommand,
): TaskCommandResult<{ assignment: TaskAssignment; completion: TaskCompletion }> {
  requireAssignedChild(assignment, command.actorId, "SUBMIT_TASK_WRONG_CHILD");
  requireAssignmentStatus(assignment, "IN_PROGRESS", "SUBMIT_TASK_WRONG_STATUS");

  const nextAssignmentVersion = assignment.version + 1;
  const nextAssignment: TaskAssignment = {
    ...assignment,
    status: "SUBMITTED",
    version: nextAssignmentVersion,
  };

  const completion: TaskCompletion = {
    taskCompletionId: command.taskCompletionId,
    taskAssignmentId: assignment.taskAssignmentId,
    childId: assignment.assignedToChildId,
    submittedAt: command.now,
    ...(command.mediaEvidenceId !== undefined ? { mediaEvidenceId: command.mediaEvidenceId } : {}),
    ...(command.counterValue !== undefined ? { counterValue: command.counterValue } : {}),
    ...(command.timerSeconds !== undefined ? { timerSeconds: command.timerSeconds } : {}),
    ...(command.selfReportNote !== undefined ? { selfReportNote: command.selfReportNote } : {}),
  };

  const event = makeTaskEvent(
    "TASK_SUBMITTED",
    assignment.familyId,
    command.actorId,
    assignment.taskAssignmentId,
    nextAssignmentVersion,
    command.now,
    {
      taskAssignmentId: assignment.taskAssignmentId,
      taskCompletionId: command.taskCompletionId,
    },
    assignment.assignedToChildId,
  );

  return { next: { assignment: nextAssignment, completion }, events: [event] };
}

/**
 * Move a submitted task into VERIFYING state. This is a system-driven
 * transition triggered after submission is received: the Verification
 * Engine or parent review begins. Separate from approveTask/rejectTask
 * to model the "occupied" state while verification is in-flight.
 */
export function beginVerification(
  assignment: TaskAssignment,
  actorId: string,
  now: string,
): TaskCommandResult<TaskAssignment> {
  if (!isValidTaskAssignmentTransition(assignment.status, "VERIFYING")) {
    throw new TaskDomainError(
      "BEGIN_VERIFICATION_INVALID_TRANSITION",
      `Assignment ${assignment.taskAssignmentId} is ${assignment.status}, cannot enter VERIFYING`,
    );
  }

  const nextVersion = assignment.version + 1;
  const nextAssignment: TaskAssignment = { ...assignment, status: "VERIFYING", version: nextVersion };

  return { next: nextAssignment, events: [] };
}

/**
 * Approve or reject a task in VERIFYING state. The actor may be a parent
 * (parent_approval strategy) or "system" (automated strategies).
 * After approval the assignment moves to APPROVED (caller drives to
 * COMPLETED); after rejection it returns to IN_PROGRESS for retry.
 */
export function verifyTask(
  assignment: TaskAssignment,
  command: VerifyTaskCommand,
): TaskCommandResult<TaskAssignment> {
  requireAssignmentStatus(assignment, "VERIFYING", "VERIFY_TASK_WRONG_STATUS");

  const targetStatus = command.outcome === "APPROVED" ? "APPROVED" : "REJECTED";
  if (!isValidTaskAssignmentTransition(assignment.status, targetStatus)) {
    throw new TaskDomainError(
      "VERIFY_TASK_INVALID_TRANSITION",
      `Cannot move assignment to ${targetStatus} from ${assignment.status}`,
    );
  }

  const nextVersion = assignment.version + 1;
  const nextAssignment: TaskAssignment = { ...assignment, status: targetStatus, version: nextVersion };

  const eventType = command.outcome === "APPROVED" ? "TASK_APPROVED" : "TASK_REJECTED";
  const event = makeTaskEvent(
    eventType,
    assignment.familyId,
    command.actorId,
    assignment.taskAssignmentId,
    nextVersion,
    command.now,
    { taskAssignmentId: assignment.taskAssignmentId, outcome: command.outcome },
    assignment.assignedToChildId,
  );

  return { next: nextAssignment, events: [event] };
}

/**
 * Complete a task (APPROVED → COMPLETED). System-driven; called after the
 * reward has been granted so the task is marked definitively finished.
 */
export function completeTask(
  assignment: TaskAssignment,
  actorId: string,
  now: string,
): TaskCommandResult<TaskAssignment> {
  if (!isValidTaskAssignmentTransition(assignment.status, "COMPLETED")) {
    throw new TaskDomainError(
      "COMPLETE_TASK_INVALID_TRANSITION",
      `Assignment ${assignment.taskAssignmentId} is ${assignment.status}, cannot complete`,
    );
  }

  const nextVersion = assignment.version + 1;
  const nextAssignment: TaskAssignment = { ...assignment, status: "COMPLETED", version: nextVersion };

  const event = makeTaskEvent(
    "TASK_COMPLETED",
    assignment.familyId,
    actorId,
    assignment.taskAssignmentId,
    nextVersion,
    now,
    { taskAssignmentId: assignment.taskAssignmentId },
    assignment.assignedToChildId,
  );

  return { next: nextAssignment, events: [event] };
}
