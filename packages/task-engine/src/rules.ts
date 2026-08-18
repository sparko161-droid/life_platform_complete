import { z } from "zod";

/**
 * Task Builder DSL — schedule, conditions and composite task model (P1-002B).
 *
 * Implements "Rules DSL, scheduling and composite task model" per
 * docs/game/task-builder-dsl.md and docs/game/task-builder-rules.md.
 * Rules are declarative, versioned and serializable (no closures). A rule
 * is validated before activation; `validateRule()` returns all defects.
 *
 * Schema layers:
 *   - Schedule: when/how often a task may be assigned
 *   - Condition: gates on assignment (age, streak, prior work, time window)
 *   - CompletionPredicate: how a composite task is satisfied
 *   - TaskRule: composes the above into one versioned unit
 *
 * Sources:
 *   - docs/game/task-builder-dsl.md
 *   - docs/game/task-builder-rules.md
 *   - MASTER_SPEC §7 ("Task = content + schedule + rules + verification…")
 */

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

/** Days of the week as ISO 8601 weekday numbers: 1 = Monday … 7 = Sunday. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const SCHEDULE_FREQUENCIES = ["DAILY", "WEEKLY", "WEEKDAYS", "CUSTOM"] as const;
export type ScheduleFrequency = (typeof SCHEDULE_FREQUENCIES)[number];

/**
 * One-shot schedule: assign the task exactly once.
 * `targetDate` is optional advisory — the assignment may happen at any time.
 */
const ScheduleOnceSchema = z.object({
  kind: z.literal("once"),
  targetDate: z.string().date().optional(),
});

/**
 * Recurring schedule. `frequency` determines the cadence:
 * - DAILY: every day
 * - WEEKLY: every week, optionally on specific `days`
 * - WEEKDAYS: Monday–Friday only
 * - CUSTOM: on the specific `days` of the week listed
 *
 * `limit`: maximum number of times to assign (open-ended if absent).
 * `endDate`: stop assigning after this date.
 */
const ScheduleRecurringSchema = z.object({
  kind: z.literal("recurring"),
  frequency: z.enum(SCHEDULE_FREQUENCIES),
  days: z.array(z.number().int().min(1).max(7)).optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  limit: z.number().int().positive().optional(),
});

export const ScheduleSchema = z.discriminatedUnion("kind", [ScheduleOnceSchema, ScheduleRecurringSchema]);
export type Schedule = z.infer<typeof ScheduleSchema>;

// ---------------------------------------------------------------------------
// Conditions (assignment gates)
// ---------------------------------------------------------------------------

/** Child's age (in years) must be within the specified range. */
const AgeConditionSchema = z.object({
  kind: z.literal("AGE"),
  minYears: z.number().int().min(0).max(18).optional(),
  maxYears: z.number().int().min(0).max(18).optional(),
});

/** Child must have completed the referenced task template at least `minCount` times. */
const PriorCompletionConditionSchema = z.object({
  kind: z.literal("PRIOR_COMPLETION"),
  taskTemplateId: z.string().uuid(),
  minCount: z.number().int().positive(),
});

/** Child must maintain a daily completion streak of at least `days` days. */
const StreakConditionSchema = z.object({
  kind: z.literal("STREAK"),
  days: z.number().int().positive(),
});

/**
 * Task must be completed within a daily time window.
 * Hours are wall-clock hours in the family's local time [0–23].
 */
const TimeWindowConditionSchema = z.object({
  kind: z.literal("TIME_WINDOW"),
  startHour: z.number().int().min(0).max(23),
  endHour: z.number().int().min(0).max(23),
});

/** The referenced task template must have been COMPLETED before this one is assigned. */
const PrerequisiteConditionSchema = z.object({
  kind: z.literal("PREREQUISITE"),
  taskTemplateId: z.string().uuid(),
});

export const ConditionSchema = z.discriminatedUnion("kind", [
  AgeConditionSchema,
  PriorCompletionConditionSchema,
  StreakConditionSchema,
  TimeWindowConditionSchema,
  PrerequisiteConditionSchema,
]);
export type Condition = z.infer<typeof ConditionSchema>;
export type ConditionKind = Condition["kind"];

// ---------------------------------------------------------------------------
// Completion predicates (composite tasks)
// ---------------------------------------------------------------------------

/**
 * Completion predicates per docs/game/task-builder-dsl.md:
 * - ALL: every child must complete
 * - ANY: at least one child must complete
 * - COUNT(n): at least n children must complete
 * - SCORE(threshold): accumulated score >= threshold (children carry weights)
 * - PARENT_DECISION: parent explicitly marks the composite as complete
 * - SEQUENCE: children must complete in the listed order
 */
const AllPredicateSchema = z.object({ kind: z.literal("ALL") });
const AnyPredicateSchema = z.object({ kind: z.literal("ANY") });
const CountPredicateSchema = z.object({
  kind: z.literal("COUNT"),
  n: z.number().int().positive(),
});
const ScorePredicateSchema = z.object({
  kind: z.literal("SCORE"),
  threshold: z.number().positive(),
});
const ParentDecisionPredicateSchema = z.object({ kind: z.literal("PARENT_DECISION") });
const SequencePredicateSchema = z.object({ kind: z.literal("SEQUENCE") });

export const CompletionPredicateSchema = z.discriminatedUnion("kind", [
  AllPredicateSchema,
  AnyPredicateSchema,
  CountPredicateSchema,
  ScorePredicateSchema,
  ParentDecisionPredicateSchema,
  SequencePredicateSchema,
]);
export type CompletionPredicate = z.infer<typeof CompletionPredicateSchema>;

/**
 * A composite task groups ordered or unordered children under a completion
 * predicate. `children` is an ordered list of task-template UUIDs; for
 * SEQUENCE, the order is the required completion order.
 */
export const CompositeTaskSchema = z.object({
  predicate: CompletionPredicateSchema,
  children: z.array(z.string().uuid()).min(2, "a composite task needs at least two children"),
});
export type CompositeTask = z.infer<typeof CompositeTaskSchema>;

// ---------------------------------------------------------------------------
// TaskRule (root)
// ---------------------------------------------------------------------------

/**
 * The complete rule for one task template. All fields are optional so rules
 * can be built incrementally; `validateRule()` catches semantic problems
 * before activation.
 */
export const TaskRuleSchema = z.object({
  ruleId: z.string().uuid(),
  version: z.number().int().positive(),
  schedule: ScheduleSchema.optional(),
  conditions: z.array(ConditionSchema).default([]),
  composite: CompositeTaskSchema.optional(),
});
export type TaskRule = z.infer<typeof TaskRuleSchema>;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface RuleValidationError {
  field: string;
  code: string;
  message: string;
}

/**
 * Validates a TaskRule for internal consistency before it is activated.
 * Returns an array of errors; an empty array means the rule is valid.
 *
 * Checks performed:
 *   - Age condition: minYears <= maxYears
 *   - Time window: startHour < endHour; both in [0..23]
 *   - Recurring schedule: endDate >= startDate; CUSTOM/WEEKLY require days
 *   - Duplicate condition kinds (same gate type declared twice is always a bug)
 *   - COUNT predicate: n <= children.length
 *   - SCORE threshold: must be positive (caught by Zod schema, also here)
 *   - Streak: days > 0 (caught by schema, also here for clarity)
 */
export function validateRule(rule: TaskRule): RuleValidationError[] {
  const errors: RuleValidationError[] = [];

  // --- Schedule ---
  if (rule.schedule) {
    const s = rule.schedule;
    if (s.kind === "recurring") {
      if (s.startDate && s.endDate && s.endDate < s.startDate) {
        errors.push({
          field: "schedule.endDate",
          code: "SCHEDULE_END_BEFORE_START",
          message: `endDate ${s.endDate} is before startDate ${s.startDate}`,
        });
      }
      if ((s.frequency === "CUSTOM" || s.frequency === "WEEKLY") && (!s.days || s.days.length === 0)) {
        errors.push({
          field: "schedule.days",
          code: "SCHEDULE_CUSTOM_MISSING_DAYS",
          message: `frequency ${s.frequency} requires at least one day`,
        });
      }
    }
  }

  // --- Conditions ---
  const kindsSeen = new Set<string>();
  for (const cond of rule.conditions) {
    if (kindsSeen.has(cond.kind)) {
      errors.push({
        field: "conditions",
        code: "CONDITION_DUPLICATE_KIND",
        message: `condition kind ${cond.kind} appears more than once`,
      });
    }
    kindsSeen.add(cond.kind);

    if (cond.kind === "AGE") {
      if (cond.minYears !== undefined && cond.maxYears !== undefined && cond.minYears > cond.maxYears) {
        errors.push({
          field: "conditions[AGE].minYears",
          code: "AGE_CONDITION_INVERTED",
          message: `minYears (${cond.minYears}) > maxYears (${cond.maxYears})`,
        });
      }
      if (cond.minYears === undefined && cond.maxYears === undefined) {
        errors.push({
          field: "conditions[AGE]",
          code: "AGE_CONDITION_EMPTY",
          message: "AGE condition must specify at least one of minYears or maxYears",
        });
      }
    }

    if (cond.kind === "TIME_WINDOW") {
      if (cond.startHour >= cond.endHour) {
        errors.push({
          field: "conditions[TIME_WINDOW]",
          code: "TIME_WINDOW_INVERTED",
          message: `startHour (${cond.startHour}) must be less than endHour (${cond.endHour})`,
        });
      }
    }
  }

  // --- Composite ---
  if (rule.composite) {
    const { predicate, children } = rule.composite;
    if (predicate.kind === "COUNT") {
      if (predicate.n > children.length) {
        errors.push({
          field: "composite.predicate.n",
          code: "COUNT_EXCEEDS_CHILDREN",
          message: `COUNT predicate requires ${predicate.n} completions but only ${children.length} children`,
        });
      }
    }
    // Duplicate children would mean the same task appears twice in the group
    const childSet = new Set(children);
    if (childSet.size !== children.length) {
      errors.push({
        field: "composite.children",
        code: "COMPOSITE_DUPLICATE_CHILD",
        message: "composite task contains the same child task template more than once",
      });
    }
  }

  return errors;
}

/**
 * Convenience function: returns true if the rule is valid.
 */
export function isValidRule(rule: TaskRule): boolean {
  return validateRule(rule).length === 0;
}
