/**
 * Tests for the Task Builder Rules DSL (P1-002B).
 *
 * Strategy: property/table-driven rule tests and invalid-rule regression
 * fixtures (per task-registry test_strategy).
 *
 * Coverage:
 *   - Schema: valid and invalid structures parse / reject correctly
 *   - validateRule: each error code produced by at least one test case
 *   - isValidRule: clean rules pass; dirty rules fail
 *   - Table-driven: invalid-rule fixtures cover each validation path
 *   - Integration: composite task with schedule and conditions
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type TaskRule,
  TaskRuleSchema,
  isValidRule,
  validateRule,
} from "../src/rules.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RULE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CHILD_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CHILD_B = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CHILD_C = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function baseRule(overrides?: Partial<TaskRule>): TaskRule {
  return {
    ruleId: RULE_ID,
    version: 1,
    conditions: [],
    ...overrides,
  };
}

function expectErrors(rule: TaskRule, ...codes: string[]): void {
  const errors = validateRule(rule);
  for (const code of codes) {
    assert.ok(
      errors.some((e) => e.code === code),
      `expected error code ${code}, got: [${errors.map((e) => e.code).join(", ")}]`,
    );
  }
}

function expectClean(rule: TaskRule): void {
  const errors = validateRule(rule);
  assert.deepEqual(errors, [], `expected no errors, got: [${errors.map((e) => e.code).join(", ")}]`);
}

// ---------------------------------------------------------------------------
// Schema: valid rule parses
// ---------------------------------------------------------------------------

test("a minimal rule (id + version) is valid", () => {
  expectClean(baseRule());
});

test("a rule with a once schedule is valid", () => {
  expectClean(baseRule({ schedule: { kind: "once", targetDate: "2026-06-01" } }));
});

test("a rule with a daily recurring schedule is valid", () => {
  expectClean(
    baseRule({
      schedule: {
        kind: "recurring",
        frequency: "DAILY",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        limit: 52,
      },
    }),
  );
});

test("a rule with WEEKDAYS frequency is valid", () => {
  expectClean(baseRule({ schedule: { kind: "recurring", frequency: "WEEKDAYS" } }));
});

test("a rule with WEEKLY frequency and days is valid", () => {
  expectClean(
    baseRule({
      schedule: { kind: "recurring", frequency: "WEEKLY", days: [1, 3, 5] },
    }),
  );
});

test("a rule with CUSTOM frequency and days is valid", () => {
  expectClean(
    baseRule({
      schedule: { kind: "recurring", frequency: "CUSTOM", days: [2, 4] },
    }),
  );
});

test("a rule with an ALL composite is valid", () => {
  expectClean(
    baseRule({
      composite: { predicate: { kind: "ALL" }, children: [CHILD_A, CHILD_B] },
    }),
  );
});

test("a rule with a COUNT(2) composite with 3 children is valid", () => {
  expectClean(
    baseRule({
      composite: { predicate: { kind: "COUNT", n: 2 }, children: [CHILD_A, CHILD_B, CHILD_C] },
    }),
  );
});

test("a rule with every condition type is valid when values are consistent", () => {
  expectClean(
    baseRule({
      conditions: [
        { kind: "AGE", minYears: 6, maxYears: 12 },
        { kind: "STREAK", days: 3 },
        { kind: "TIME_WINDOW", startHour: 8, endHour: 20 },
        { kind: "PRIOR_COMPLETION", taskTemplateId: CHILD_A, minCount: 2 },
        { kind: "PREREQUISITE", taskTemplateId: CHILD_B },
      ],
    }),
  );
});

// ---------------------------------------------------------------------------
// Table-driven invalid-rule fixtures
// ---------------------------------------------------------------------------

const INVALID_FIXTURES: Array<{ name: string; rule: TaskRule; expectedCodes: string[] }> = [
  {
    name: "schedule.endDate before startDate",
    rule: baseRule({
      schedule: {
        kind: "recurring",
        frequency: "DAILY",
        startDate: "2026-06-01",
        endDate: "2026-01-01",
      },
    }),
    expectedCodes: ["SCHEDULE_END_BEFORE_START"],
  },
  {
    name: "CUSTOM frequency without days",
    rule: baseRule({
      schedule: { kind: "recurring", frequency: "CUSTOM" },
    }),
    expectedCodes: ["SCHEDULE_CUSTOM_MISSING_DAYS"],
  },
  {
    name: "WEEKLY frequency without days",
    rule: baseRule({
      schedule: { kind: "recurring", frequency: "WEEKLY" },
    }),
    expectedCodes: ["SCHEDULE_CUSTOM_MISSING_DAYS"],
  },
  {
    name: "AGE condition: minYears > maxYears",
    rule: baseRule({
      conditions: [{ kind: "AGE", minYears: 14, maxYears: 10 }],
    }),
    expectedCodes: ["AGE_CONDITION_INVERTED"],
  },
  {
    name: "AGE condition: neither minYears nor maxYears",
    rule: baseRule({ conditions: [{ kind: "AGE" }] }),
    expectedCodes: ["AGE_CONDITION_EMPTY"],
  },
  {
    name: "TIME_WINDOW: startHour >= endHour",
    rule: baseRule({
      conditions: [{ kind: "TIME_WINDOW", startHour: 20, endHour: 8 }],
    }),
    expectedCodes: ["TIME_WINDOW_INVERTED"],
  },
  {
    name: "TIME_WINDOW: startHour === endHour",
    rule: baseRule({
      conditions: [{ kind: "TIME_WINDOW", startHour: 12, endHour: 12 }],
    }),
    expectedCodes: ["TIME_WINDOW_INVERTED"],
  },
  {
    name: "duplicate condition kind",
    rule: baseRule({
      conditions: [
        { kind: "STREAK", days: 3 },
        { kind: "STREAK", days: 7 },
      ],
    }),
    expectedCodes: ["CONDITION_DUPLICATE_KIND"],
  },
  {
    name: "COUNT predicate n exceeds children count",
    rule: baseRule({
      composite: { predicate: { kind: "COUNT", n: 5 }, children: [CHILD_A, CHILD_B, CHILD_C] },
    }),
    expectedCodes: ["COUNT_EXCEEDS_CHILDREN"],
  },
  {
    name: "composite has duplicate children",
    rule: baseRule({
      composite: { predicate: { kind: "ALL" }, children: [CHILD_A, CHILD_A] },
    }),
    expectedCodes: ["COMPOSITE_DUPLICATE_CHILD"],
  },
];

for (const fixture of INVALID_FIXTURES) {
  test(`invalid rule: ${fixture.name}`, () => {
    expectErrors(fixture.rule, ...fixture.expectedCodes);
  });
}

// ---------------------------------------------------------------------------
// isValidRule
// ---------------------------------------------------------------------------

test("isValidRule returns true for a clean rule", () => {
  assert.equal(isValidRule(baseRule()), true);
});

test("isValidRule returns false for a rule with errors", () => {
  const bad = baseRule({ conditions: [{ kind: "AGE" }] });
  assert.equal(isValidRule(bad), false);
});

// ---------------------------------------------------------------------------
// Multiple errors accumulate
// ---------------------------------------------------------------------------

test("a rule can produce multiple errors at once", () => {
  const multiErrorRule = baseRule({
    schedule: {
      kind: "recurring",
      frequency: "CUSTOM",
      // no days → SCHEDULE_CUSTOM_MISSING_DAYS
      startDate: "2026-12-01",
      endDate: "2026-01-01", // end before start → SCHEDULE_END_BEFORE_START
    },
    conditions: [
      { kind: "AGE", minYears: 15, maxYears: 10 }, // inverted → AGE_CONDITION_INVERTED
      { kind: "TIME_WINDOW", startHour: 22, endHour: 6 }, // inverted → TIME_WINDOW_INVERTED
    ],
    composite: {
      predicate: { kind: "COUNT", n: 10 },
      children: [CHILD_A, CHILD_B], // COUNT 10 > 2 children → COUNT_EXCEEDS_CHILDREN
    },
  });

  expectErrors(
    multiErrorRule,
    "SCHEDULE_END_BEFORE_START",
    "SCHEDULE_CUSTOM_MISSING_DAYS",
    "AGE_CONDITION_INVERTED",
    "TIME_WINDOW_INVERTED",
    "COUNT_EXCEEDS_CHILDREN",
  );
});

// ---------------------------------------------------------------------------
// Each completion predicate kind
// ---------------------------------------------------------------------------

const PREDICATE_FIXTURES = [
  { kind: "ALL" },
  { kind: "ANY" },
  { kind: "COUNT", n: 1 },
  { kind: "SCORE", threshold: 100 },
  { kind: "PARENT_DECISION" },
  { kind: "SEQUENCE" },
] as const;

for (const pred of PREDICATE_FIXTURES) {
  test(`completion predicate ${pred.kind} is accepted`, () => {
    expectClean(
      baseRule({
        composite: { predicate: pred as any, children: [CHILD_A, CHILD_B] },
      }),
    );
  });
}

// ---------------------------------------------------------------------------
// Integration: full composite rule with schedule and conditions
// ---------------------------------------------------------------------------

test("integration: daily task for ages 8-12, streak 5 days, composite ALL of 3 children", () => {
  const rule: TaskRule = {
    ruleId: RULE_ID,
    version: 1,
    schedule: {
      kind: "recurring",
      frequency: "DAILY",
      startDate: "2026-01-01",
    },
    conditions: [
      { kind: "AGE", minYears: 8, maxYears: 12 },
      { kind: "STREAK", days: 5 },
      { kind: "TIME_WINDOW", startHour: 7, endHour: 21 },
    ],
    composite: {
      predicate: { kind: "ALL" },
      children: [CHILD_A, CHILD_B, CHILD_C],
    },
  };

  expectClean(rule);
  assert.equal(isValidRule(rule), true);
});

test("integration: sequence task with prerequisite and prior completion gate", () => {
  const rule: TaskRule = {
    ruleId: RULE_ID,
    version: 2,
    conditions: [
      { kind: "PREREQUISITE", taskTemplateId: CHILD_A },
      { kind: "PRIOR_COMPLETION", taskTemplateId: CHILD_B, minCount: 3 },
    ],
    composite: {
      predicate: { kind: "SEQUENCE" },
      children: [CHILD_B, CHILD_C],
    },
  };

  expectClean(rule);
});

// ---------------------------------------------------------------------------
// Schema-level rejection (Zod parse)
// ---------------------------------------------------------------------------

test("TaskRuleSchema rejects a rule with a negative limit", () => {
  const bad = { ruleId: RULE_ID, version: 1, schedule: { kind: "recurring", frequency: "DAILY", limit: -1 } };
  const result = TaskRuleSchema.safeParse(bad);
  assert.equal(result.success, false);
});

test("TaskRuleSchema rejects a composite with only one child", () => {
  const bad = {
    ruleId: RULE_ID,
    version: 1,
    composite: { predicate: { kind: "ALL" }, children: [CHILD_A] },
  };
  const result = TaskRuleSchema.safeParse(bad);
  assert.equal(result.success, false);
});
