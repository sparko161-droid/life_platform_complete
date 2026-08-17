import { z } from "zod";
import { ChildId, FamilyId, MediaEvidenceId, ParentId, TaskAssignmentId, TaskCompletionId, TaskTemplateId } from "./ids.js";
import { VERIFICATION_STRATEGIES } from "./verification.js";
import type { ClassificationMap } from "./classification.js";

/**
 * Ownership: Task Engine domain. Authorization: created/edited by a
 * parent with no extra capability required (task management is base
 * parent access per docs/product/actors-and-permissions.md — "Parent can
 * manage permitted children, tasks, rewards..."); reading is scoped to
 * the owning family. `docs/MASTER_SPEC.md` §7: "Task = content +
 * schedule + rules + verification + reward + gameplay + notifications" —
 * this contract covers content/schedule/verification/reward; rules/
 * gameplay/notifications config is deferred to P0-010's Rules DSL
 * (registry.yaml P1-002 depends on both P0-009 and P0-010).
 *
 * `status` replaces the 0.1.0 `isActive: boolean` (P0-009 revalidation,
 * docs/planning/change-log.md 0.5): docs/architecture/entity-lifecycle.md
 * landed after 0.1.0 and gives `DRAFT → ACTIVE → ARCHIVED → DELETED` as
 * the default lifecycle pattern; a bare boolean couldn't represent DRAFT
 * or ARCHIVED. Safe to revise now — this is a contract, not yet consumed
 * by running code (no Phase 1 implementation exists).
 */
export const TASK_TEMPLATE_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export type TaskTemplateStatus = (typeof TASK_TEMPLATE_STATUSES)[number];

const TASK_TEMPLATE_TRANSITIONS: Record<TaskTemplateStatus, TaskTemplateStatus[]> = {
  DRAFT: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["ARCHIVED"],
  ARCHIVED: [],
};
export function isValidTaskTemplateTransition(
  from: TaskTemplateStatus,
  to: TaskTemplateStatus,
): boolean {
  return from !== to && (TASK_TEMPLATE_TRANSITIONS[from]?.includes(to) ?? false);
}

export const TaskTemplateSchema = z.object({
  taskTemplateId: TaskTemplateId,
  familyId: FamilyId,
  createdByParentId: ParentId,
  title: z.string().min(1).max(120),
  verificationStrategy: z.enum(VERIFICATION_STRATEGIES),
  // Reward amounts are opaque here on purpose -- the actual XP/coin/money
  // economy shape is Game Engine territory (docs/game/economy.md); this
  // contract only fixes that a task template names a reward, not its
  // internal composition.
  rewardXp: z.number().int().nonnegative(),
  rewardCoins: z.number().int().nonnegative(),
  status: z.enum(TASK_TEMPLATE_STATUSES),
  // Optimistic concurrency per docs/architecture/concurrency-and-conflicts.md
  // ("Task edited while child is working: the active assignment keeps its
  // resolved task version unless policy explicitly allows migration").
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
});
export type TaskTemplate = z.infer<typeof TaskTemplateSchema>;

export const TASK_TEMPLATE_CLASSIFICATION: ClassificationMap<keyof TaskTemplate> = {
  taskTemplateId: "FAMILY",
  familyId: "FAMILY",
  createdByParentId: "FAMILY",
  title: "FAMILY",
  verificationStrategy: "FAMILY",
  rewardXp: "FAMILY",
  rewardCoins: "FAMILY",
  status: "FAMILY",
  version: "FAMILY",
  createdAt: "FAMILY",
};

/**
 * Canonical states per docs/architecture/entity-lifecycle.md's "## Task"
 * section: `DRAFT → ACTIVE → ASSIGNED → IN_PROGRESS → SUBMITTED →
 * VERIFYING → APPROVED/REJECTED → COMPLETED → ARCHIVED`. That doc landed
 * after the 0.1.0 contract (which only had
 * ASSIGNED/IN_PROGRESS/SUBMITTED/APPROVED/REJECTED) and models "Task" as
 * one merged concept; this package keeps the TaskTemplate/TaskAssignment
 * split from 0.1.0 (a template is reusable across children, an assignment
 * is one child's instance) and reconciles by giving DRAFT/ACTIVE/ARCHIVED
 * to TaskTemplateStatus above and the assignment-specific tail
 * (ASSIGNED..ARCHIVED) here. VERIFYING is new in 0.2.0: it's the gap
 * between "child submitted" and "an outcome exists" -- occupied by either
 * the Verification Engine (automated strategies) or an unactioned parent
 * approval request. REJECTED → IN_PROGRESS (retry) is carried over from
 * 0.1.0 as a disclosed inference, not stated verbatim in either doc.
 */
export const TASK_ASSIGNMENT_STATUSES = [
  "ASSIGNED",
  "IN_PROGRESS",
  "SUBMITTED",
  "VERIFYING",
  "APPROVED",
  "REJECTED",
  "COMPLETED",
  "ARCHIVED",
] as const;
export type TaskAssignmentStatus = (typeof TASK_ASSIGNMENT_STATUSES)[number];

const TASK_ASSIGNMENT_TRANSITIONS: Record<TaskAssignmentStatus, TaskAssignmentStatus[]> = {
  ASSIGNED: ["IN_PROGRESS"],
  IN_PROGRESS: ["SUBMITTED"],
  SUBMITTED: ["VERIFYING"],
  VERIFYING: ["APPROVED", "REJECTED"],
  APPROVED: ["COMPLETED"],
  REJECTED: ["IN_PROGRESS"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: [],
};
export function isValidTaskAssignmentTransition(
  from: TaskAssignmentStatus,
  to: TaskAssignmentStatus,
): boolean {
  return from !== to && (TASK_ASSIGNMENT_TRANSITIONS[from]?.includes(to) ?? false);
}

/**
 * Authorization: the assigned child (and any parent with default access)
 * can read; only the child can move ASSIGNED->IN_PROGRESS->SUBMITTED;
 * only a parent with base task access (PARENT_APPROVAL strategy) or the
 * Verification Engine (automated strategies) can move
 * VERIFYING->APPROVED/REJECTED; COMPLETED/ARCHIVED are system-driven
 * housekeeping transitions. Events: TASK_ASSIGNED, TASK_STARTED,
 * TASK_COMPLETED, VERIFICATION_COMPLETED, TASK_APPROVED, TASK_REJECTED.
 * `version`: optimistic concurrency per
 * docs/architecture/concurrency-and-conflicts.md ("Two parents approve
 * one completion: only one canonical approval effect").
 */
export const TaskAssignmentSchema = z.object({
  taskAssignmentId: TaskAssignmentId,
  taskTemplateId: TaskTemplateId,
  familyId: FamilyId,
  assignedToChildId: ChildId,
  status: z.enum(TASK_ASSIGNMENT_STATUSES),
  version: z.number().int().positive(),
  assignedAt: z.string().datetime(),
  dueAt: z.string().datetime().optional(),
});
export type TaskAssignment = z.infer<typeof TaskAssignmentSchema>;

export const TASK_ASSIGNMENT_CLASSIFICATION: ClassificationMap<keyof TaskAssignment> = {
  taskAssignmentId: "CHILD_PRIVATE",
  taskTemplateId: "FAMILY",
  familyId: "FAMILY",
  assignedToChildId: "CHILD_PRIVATE",
  status: "CHILD_PRIVATE",
  version: "CHILD_PRIVATE",
  assignedAt: "CHILD_PRIVATE",
  dueAt: "CHILD_PRIVATE",
};

/**
 * The child's raw submission -- distinct from VerificationResult
 * (verification.ts), which is the Verification Engine's judgement of
 * this completion. `Task → Verification Strategy → Result` (MASTER_SPEC
 * §8): TaskCompletion is the "Task" side input, VerificationResult is
 * the "Result" side output. No `version` here: unlike TaskAssignment,
 * a completion is an immutable append-only record of what was submitted,
 * not a mutable aggregate that gets edited in place.
 */
export const TaskCompletionSchema = z.object({
  taskCompletionId: TaskCompletionId,
  taskAssignmentId: TaskAssignmentId,
  childId: ChildId,
  submittedAt: z.string().datetime(),
  mediaEvidenceId: MediaEvidenceId.optional(),
  counterValue: z.number().int().nonnegative().optional(),
  timerSeconds: z.number().int().nonnegative().optional(),
  selfReportNote: z.string().max(500).optional(),
});
export type TaskCompletion = z.infer<typeof TaskCompletionSchema>;

export const TASK_COMPLETION_CLASSIFICATION: ClassificationMap<keyof TaskCompletion> = {
  taskCompletionId: "CHILD_PRIVATE",
  taskAssignmentId: "CHILD_PRIVATE",
  childId: "CHILD_PRIVATE",
  submittedAt: "CHILD_PRIVATE",
  mediaEvidenceId: "CHILD_PRIVATE",
  counterValue: "CHILD_PRIVATE",
  timerSeconds: "CHILD_PRIVATE",
  selfReportNote: "CHILD_PRIVATE",
};
