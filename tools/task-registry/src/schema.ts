import { z } from "zod";

/**
 * Task lifecycle state machine.
 *
 * Source of truth for state names: docs/ai-team/task-lifecycle.md.
 *
 * Extension beyond that doc: `PLANNED` is a pre-BACKLOG holding state for
 * tasks in a later phase whose dependencies are not satisfied yet (this is
 * how tasks/registry.yaml already used it before this tool existed). It is
 * disclosed here rather than silently invented.
 */
export const TASK_STATES = [
  "PLANNED",
  "BACKLOG",
  "ANALYSIS",
  "ARCHITECTURE_CHECK",
  "READY",
  "IN_PROGRESS",
  "REVIEW",
  "REWORK",
  "PASS_WITH_DISCOVERIES",
  "DISCOVERY_TRIAGE",
  "NEW_TASK",
  "QA",
  "SECURITY",
  "ACCEPTANCE",
  "DONE",
  "ARCHITECTURE_BLOCKED",
  "PRODUCT_BLOCKED",
  "SECURITY_BLOCKED",
  "DEPENDENCY_BLOCKED",
] as const;

export type TaskState = (typeof TASK_STATES)[number];

const BLOCKED_STATES: TaskState[] = [
  "ARCHITECTURE_BLOCKED",
  "PRODUCT_BLOCKED",
  "SECURITY_BLOCKED",
  "DEPENDENCY_BLOCKED",
];

/**
 * Allowed forward transitions per docs/ai-team/task-lifecycle.md:
 * - main path: BACKLOG -> ANALYSIS -> ARCHITECTURE_CHECK -> READY -> IN_PROGRESS
 *   -> REVIEW -> QA -> SECURITY -> ACCEPTANCE -> DONE
 * - rework: REVIEW -> REWORK -> IN_PROGRESS
 * - discovery: REVIEW -> PASS_WITH_DISCOVERIES -> DISCOVERY_TRIAGE -> NEW_TASK
 * - blocked: any active state -> *_BLOCKED, and back once resolved
 */
const TRANSITIONS: Record<TaskState, TaskState[]> = {
  PLANNED: ["BACKLOG", "READY"],
  BACKLOG: ["ANALYSIS", ...BLOCKED_STATES],
  ANALYSIS: ["ARCHITECTURE_CHECK", ...BLOCKED_STATES],
  ARCHITECTURE_CHECK: ["READY", ...BLOCKED_STATES],
  READY: ["IN_PROGRESS", ...BLOCKED_STATES],
  IN_PROGRESS: ["REVIEW", ...BLOCKED_STATES],
  REVIEW: ["QA", "REWORK", "PASS_WITH_DISCOVERIES", ...BLOCKED_STATES],
  REWORK: ["IN_PROGRESS"],
  PASS_WITH_DISCOVERIES: ["DISCOVERY_TRIAGE"],
  DISCOVERY_TRIAGE: ["NEW_TASK", "QA"],
  NEW_TASK: [],
  QA: ["SECURITY", "REWORK", ...BLOCKED_STATES],
  SECURITY: ["ACCEPTANCE", "REWORK", "SECURITY_BLOCKED"],
  ACCEPTANCE: ["DONE", "REWORK"],
  DONE: [],
  ARCHITECTURE_BLOCKED: ["IN_PROGRESS", "BACKLOG"],
  PRODUCT_BLOCKED: ["IN_PROGRESS", "BACKLOG"],
  SECURITY_BLOCKED: ["IN_PROGRESS", "BACKLOG"],
  DEPENDENCY_BLOCKED: ["IN_PROGRESS", "READY"],
};

export function isValidTransition(from: TaskState, to: TaskState): boolean {
  if (from === to) return false;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function allowedNextStates(from: TaskState): TaskState[] {
  return TRANSITIONS[from] ?? [];
}

export const discoverySchema = z.object({
  discovery_id: z.string(),
  source_task: z.string(),
  type: z.enum([
    "DEFECT",
    "MISSING_REQUIREMENT",
    "ARCHITECTURE_GAP",
    "NEW_DEPENDENCY",
    "TECH_DEBT",
    "SECURITY_FINDING",
    "UX_GAP",
    "QA_GAP",
    "PERFORMANCE_GAP",
    "DOCUMENTATION_GAP",
  ]),
  finding: z.string(),
  why_it_matters: z.string(),
  affected_domains: z.array(z.string()).default([]),
  architecture_impact: z.string().nullable().default(null),
  security_impact: z.string().nullable().default(null),
  ux_impact: z.string().nullable().default(null),
  recommended_solution: z.string().nullable().default(null),
  alternatives: z.array(z.string()).default([]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  blocking: z.boolean().default(false),
  proposed_task: z.string().nullable().default(null),
});
export type Discovery = z.infer<typeof discoverySchema>;

export const humanDecisionSchema = z.object({
  decision_id: z.string(),
  question: z.string(),
  decision: z.string().nullable().default(null),
  decided_at: z.string().nullable().default(null),
});
export type HumanDecision = z.infer<typeof humanDecisionSchema>;

export const taskSchema = z.object({
  id: z.string().regex(/^P\d+-\d{3}$/, "task id must look like P0-001"),
  phase: z.number().int().nonnegative(),
  title: z.string().min(1),
  primary: z.string().min(1),
  status: z.enum(TASK_STATES),
  deps: z.array(z.string()).default([]),
  reviewer: z.string().nullable().default(null),
  gate_owners: z.array(z.string()).default([]),
  discovery_links: z.array(discoverySchema).default([]),
  blocked_reason: z.string().nullable().default(null),
  human_decisions: z.array(humanDecisionSchema).default([]),
  origin_discovery: z.string().nullable().default(null),
  discovered_from: z.string().nullable().default(null),
});
export type Task = z.infer<typeof taskSchema>;

export const registrySchema = z.object({
  version: z.number().int().positive(),
  tasks: z.array(taskSchema),
});
export type Registry = z.infer<typeof registrySchema>;
