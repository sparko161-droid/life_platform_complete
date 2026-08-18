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
/** @public Exported for consumers that need the full state list (dashboards, validators). */
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

/** @public Used by handoff documents and future discovery-triage tooling. */
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
/** @public */
export type Discovery = z.infer<typeof discoverySchema>;

/** @public */
export const humanDecisionSchema = z.object({
  decision_id: z.string(),
  question: z.string(),
  decision: z.string().nullable().default(null),
  decided_at: z.string().nullable().default(null),
});
/** @public */
export type HumanDecision = z.infer<typeof humanDecisionSchema>;

/**
 * Wave/priority/acceptance metadata per docs/governance/task-admission.md
 * ("Mandatory metadata before READY") and docs/planning/phase-1-execution-plan.md's
 * wave model (adopted from `agent/phase-1-execution-governance`, reconciled
 * onto this branch's schema rather than merged wholesale -- see that
 * branch's `tools/task-registry/src/schema.ts` for the original).
 *
 * Defaulted (not required) so loading the existing 58+ tasks that predate
 * this field never fails -- `readyAdmissionProblems` below is what actually
 * enforces completeness, and only for tasks already at READY.
 * @public
 */
export const taskExecutionSchema = z
  .object({
    wave: z.string().min(1).default("UNASSIGNED"),
    priority: z.enum(["P0", "P1", "P2", "P3"]).default("P2"),
    acceptance_criteria: z.string().default(""),
    test_strategy: z.string().default(""),
    source_reference: z.string().default(""),
  })
  .default({
    wave: "UNASSIGNED",
    priority: "P2",
    acceptance_criteria: "",
    test_strategy: "",
    source_reference: "",
  });
/** @public */
export type TaskExecution = z.infer<typeof taskExecutionSchema>;

export const taskSchema = z.object({
  // Trailing letter (P1-002A/P1-002B) is a split-task suffix per
  // docs/governance/task-admission.md's "an oversized task is split into
  // independently reviewable units" -- widened from `agent/phase-1-execution-governance`'s
  // original `/^P\d+-\d{3,}$/u`, which was a real bug: it rejected the
  // exact P1-002A/P1-002B ids that branch's own tasks/phase-1-participant-matrix.yaml
  // defines. Found by actually running the split, not by reading the regex.
  id: z.string().regex(/^P\d+-\d{3,}[A-Z]?$/u, "task id must look like P0-001, P1-019 or P1-002A"),
  phase: z.number().int().nonnegative(),
  title: z.string().min(1),
  primary: z.string().min(1),
  status: z.enum(TASK_STATES),
  /**
   * Unclassified dependencies. Legacy field, kept so registries written
   * before BLK-P1-003 still load; `readyAdmissionProblems` rejects any
   * task that still has entries here at READY, which is what actually
   * forces the migration instead of letting both models coexist forever.
   */
  deps: z.array(z.string()).default([]),
  /**
   * docs/governance/task-admission.md: "the upstream contract is
   * sufficiently frozen and validated for parallel consumers". These gate
   * *starting* the task -- see claimableTasks().
   */
  deps_contract: z.array(z.string()).default([]),
  /**
   * docs/governance/task-admission.md: "upstream runtime implementation
   * must be DONE before integration or release". These do NOT gate
   * starting the task; they gate offering it for integration -- see
   * integrationProblems().
   */
  deps_implementation: z.array(z.string()).default([]),
  reviewer: z.string().nullable().default(null),
  gate_owners: z.array(z.string()).default([]),
  discovery_links: z.array(discoverySchema).default([]),
  blocked_reason: z.string().nullable().default(null),
  human_decisions: z.array(humanDecisionSchema).default([]),
  origin_discovery: z.string().nullable().default(null),
  discovered_from: z.string().nullable().default(null),
  execution: taskExecutionSchema,
});
export type Task = z.infer<typeof taskSchema>;

/**
 * Every dependency edge a task declares, regardless of class. Existence
 * and cycle checks care about the edge, not about which gate it controls,
 * so they go through this rather than reading one of the three fields and
 * silently ignoring the others.
 */
export function allDependencies(task: Task): string[] {
  return [...task.deps, ...task.deps_contract, ...task.deps_implementation];
}

/**
 * docs/governance/task-admission.md's integration rule: "A task may work
 * against a frozen contract. It may not merge/integrate against an
 * unfinished implementation dependency."
 *
 * Which is why this is a *separate* check from readyAdmissionProblems and
 * from claimability: an implementation dependency that is not DONE is not
 * a reason to refuse to start work, only a reason to refuse to integrate
 * it. Enforced at the IN_PROGRESS -> REVIEW transition (`task-registry
 * handoff`), because that is the point where work is offered for merge --
 * the first moment the rule can bite without also blocking the parallel
 * contract-driven work the rule exists to allow.
 */
export function integrationProblems(task: Task, statusOf: (id: string) => TaskState | undefined): string[] {
  const problems: string[] = [];
  for (const dep of task.deps_implementation) {
    const status = statusOf(dep);
    if (status !== "DONE") {
      problems.push(`implementation dependency ${dep} is ${status ?? "unknown"}, not DONE`);
    }
  }
  return problems;
}

/**
 * docs/governance/task-admission.md's "Mandatory metadata before READY" and
 * "Blocking conditions", checked structurally. Only meaningful for a task
 * already at (or entering) READY -- see validateStructure() in registry.ts,
 * which calls this only for status === "READY" tasks, matching how the
 * rest of the lifecycle already scopes checks to the relevant state rather
 * than validating every field on every task regardless of where it is in
 * the lifecycle.
 */
export function readyAdmissionProblems(task: Task): string[] {
  const problems: string[] = [];
  if (!task.primary) problems.push("missing primary executor");
  if (!task.reviewer) problems.push("missing independent reviewer");
  if (task.gate_owners.length === 0) problems.push("missing gate owners");
  if (!task.execution.wave || task.execution.wave === "UNASSIGNED") problems.push("missing wave assignment");
  if (!task.execution.source_reference) problems.push("missing source reference");
  if (!task.execution.acceptance_criteria) problems.push("missing acceptance criteria");
  if (!task.execution.test_strategy) problems.push("missing test strategy");
  if (task.discovery_links.some((d) => d.blocking)) problems.push("blocking discovery remains unresolved");
  if (task.human_decisions.some((d) => d.decision === null)) problems.push("unresolved human decision remains");
  if (task.reviewer === task.primary) problems.push("reviewer must be independent from primary executor");
  if (task.deps.length > 0) {
    problems.push(
      `dependencies are not classified: ${task.deps.join(", ")} must move to deps_contract or deps_implementation`,
    );
  }
  return problems;
}

export const registrySchema = z.object({
  version: z.number().int().positive(),
  tasks: z.array(taskSchema),
});
export type Registry = z.infer<typeof registrySchema>;
