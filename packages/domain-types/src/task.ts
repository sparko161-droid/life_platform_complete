import { z } from "zod";
import { ChildId, FamilyId, MediaEvidenceId, ParentId, TaskAssignmentId, TaskCompletionId, TaskTemplateId } from "./ids.js";
import { VERIFICATION_STRATEGIES } from "./verification.js";

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
 */
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
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
});
export type TaskTemplate = z.infer<typeof TaskTemplateSchema>;

// docs/architecture/events.md's TASK_ASSIGNED/STARTED/COMPLETED/APPROVED/
// REJECTED, read as a state machine. REJECTED -> IN_PROGRESS (retry) is
// an inference, not stated in the docs; flagged for P1-002 to confirm.
export const TASK_ASSIGNMENT_STATUSES = [
  "ASSIGNED",
  "IN_PROGRESS",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
] as const;
export type TaskAssignmentStatus = (typeof TASK_ASSIGNMENT_STATUSES)[number];

const TASK_ASSIGNMENT_TRANSITIONS: Record<TaskAssignmentStatus, TaskAssignmentStatus[]> = {
  ASSIGNED: ["IN_PROGRESS"],
  IN_PROGRESS: ["SUBMITTED"],
  SUBMITTED: ["APPROVED", "REJECTED"],
  APPROVED: [],
  REJECTED: ["IN_PROGRESS"],
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
 * SUBMITTED->APPROVED/REJECTED. Events: TASK_ASSIGNED, TASK_STARTED,
 * TASK_COMPLETED, TASK_APPROVED, TASK_REJECTED.
 */
export const TaskAssignmentSchema = z.object({
  taskAssignmentId: TaskAssignmentId,
  taskTemplateId: TaskTemplateId,
  familyId: FamilyId,
  assignedToChildId: ChildId,
  status: z.enum(TASK_ASSIGNMENT_STATUSES),
  assignedAt: z.string().datetime(),
  dueAt: z.string().datetime().optional(),
});
export type TaskAssignment = z.infer<typeof TaskAssignmentSchema>;

/**
 * The child's raw submission -- distinct from VerificationResult
 * (verification.ts), which is the Verification Engine's judgement of
 * this completion. `Task → Verification Strategy → Result` (MASTER_SPEC
 * §8): TaskCompletion is the "Task" side input, VerificationResult is
 * the "Result" side output.
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
