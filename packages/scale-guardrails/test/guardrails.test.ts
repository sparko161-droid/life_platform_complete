/**
 * Scale guardrail regression tests (P1-022).
 *
 * Strategy: "Targeted query/benchmark fixtures and representative
 * synthetic family/task history" (tasks/registry.yaml P1-022). With no
 * persistence layer yet (BLK-P1-007 open), there is no query to
 * benchmark -- the targeted fixtures here instead prove each VERIFIED
 * guardrail's claim against real domain-types code, and structurally
 * validate that every DEFERRED guardrail carries a registered risk with
 * an owner, reason and phase target per the doc's "Required evidence".
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  IDEMPOTENCY_RULES,
  MediaEvidenceSchema,
  RewardLedgerEntrySchema,
  StaleVersionError,
  checkAssignmentVersion,
  computeBalance,
  grantTaskReward,
} from "@life/domain-types";
import type { RewardLedgerEntry } from "@life/domain-types";
import { GUARDRAIL_STATUSES, GuardrailSchema, ScaleRiskSchema, validateGuardrail, validateScaleRisk } from "../src/guardrail.js";
import { SCALE_GUARDRAILS } from "../src/guardrails.js";
import { SCALE_RISK_REGISTER } from "../src/risk-register.js";

const FAMILY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CHILD_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ASSIGNMENT_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

// ---------------------------------------------------------------------------
// SG-004: media bytes never in the primary DB
// ---------------------------------------------------------------------------

test("SG-004: MediaEvidenceSchema has no inline-bytes field", () => {
  const shape = Object.keys(MediaEvidenceSchema.shape);
  for (const key of shape) {
    // sizeBytes is metadata (a number), not inline content -- excluded
    // explicitly rather than loosening the pattern, so an actual
    // `contentBytes`/`blob`/`base64Data` field would still be caught.
    if (key === "sizeBytes") continue;
    assert.doesNotMatch(key.toLowerCase(), /bytes|blob|base64|^data$/u, `unexpected inline-media field: ${key}`);
  }
  assert.ok(shape.includes("storageKey"));
});

// ---------------------------------------------------------------------------
// SG-005: reward ledger is append-only
// ---------------------------------------------------------------------------

test("SG-005: the reward ledger has no mutable balance field", () => {
  const shape = Object.keys(RewardLedgerEntrySchema.shape);
  assert.ok(!shape.includes("balance"), "RewardLedgerEntry must never carry a stored balance");
  assert.ok(shape.includes("amount"), "balance must always be derived from signed amount entries");
});

test("SG-005: computeBalance derives the total from entries, never a stored field", () => {
  const ledger: RewardLedgerEntry[] = [];
  const first = grantTaskReward(ledger, {
    familyId: FAMILY_A as any,
    childId: CHILD_A as any,
    sourceTaskAssignmentId: ASSIGNMENT_A as any,
    xpAmount: 30,
    coinsAmount: 10,
    now: "2026-08-19T00:00:00.000Z",
  });
  if (first.xp && !first.xp.duplicate) ledger.push(first.xp.entry);
  if (first.coins && !first.coins.duplicate) ledger.push(first.coins.entry);
  assert.equal(computeBalance(ledger, "XP"), 30);
  assert.equal(computeBalance(ledger, "COINS"), 10);
});

// ---------------------------------------------------------------------------
// SG-006: concurrent writes have version/idempotency-key semantics
// ---------------------------------------------------------------------------

test("SG-006: checkAssignmentVersion gives explicit optimistic-version semantics", () => {
  const assignment = { taskAssignmentId: ASSIGNMENT_A as any, version: 3 } as any;
  assert.doesNotThrow(() => checkAssignmentVersion(assignment, 3));
  assert.throws(() => checkAssignmentVersion(assignment, 2), StaleVersionError);
});

test("SG-006: grantTaskReward gives explicit idempotency-key semantics", () => {
  const first = grantTaskReward([], {
    familyId: FAMILY_A as any,
    childId: CHILD_A as any,
    sourceTaskAssignmentId: ASSIGNMENT_A as any,
    xpAmount: 10,
    coinsAmount: 0,
    now: "2026-08-19T00:00:00.000Z",
  });
  assert.equal(first.xp!.entry.idempotencyKey.length > 0, true);
});

// ---------------------------------------------------------------------------
// SG-007: async events are retryable without duplicate domain truth
// ---------------------------------------------------------------------------

test("SG-007: replaying a reward grant produces no duplicate domain truth", () => {
  const ledger: RewardLedgerEntry[] = [];
  const first = grantTaskReward(ledger, {
    familyId: FAMILY_A as any,
    childId: CHILD_A as any,
    sourceTaskAssignmentId: ASSIGNMENT_A as any,
    xpAmount: 20,
    coinsAmount: 0,
    now: "2026-08-19T00:00:00.000Z",
  });
  ledger.push(first.xp!.entry);
  const replay = grantTaskReward(ledger, {
    familyId: FAMILY_A as any,
    childId: CHILD_A as any,
    sourceTaskAssignmentId: ASSIGNMENT_A as any,
    xpAmount: 20,
    coinsAmount: 0,
    now: "2026-08-19T00:00:00.000Z",
  });
  assert.equal(replay.xp!.duplicate, true);
  assert.equal(replay.xp!.events.length, 0);
  assert.equal(computeBalance(ledger, "XP"), 20);
});

test("SG-007: IDEMPOTENCY_RULES documents replay-safety for every pipeline stage", () => {
  assert.equal(IDEMPOTENCY_RULES.length, 7);
  for (const rule of IDEMPOTENCY_RULES) {
    assert.ok(rule.expectedOutcome.length > 0);
  }
});

// ---------------------------------------------------------------------------
// Structural coverage
// ---------------------------------------------------------------------------

test("SCALE_GUARDRAILS: exactly 8 entries, matching the doc's 8 mandatory checks", () => {
  assert.equal(SCALE_GUARDRAILS.length, 8);
});

test("SCALE_GUARDRAILS: ids are unique and every status value is used at least once", () => {
  const ids = SCALE_GUARDRAILS.map((g) => g.id);
  assert.equal(new Set(ids).size, ids.length);
  const statuses = new Set(SCALE_GUARDRAILS.map((g) => g.status));
  for (const s of GUARDRAIL_STATUSES) {
    assert.ok(statuses.has(s), `no guardrail uses status ${s}`);
  }
});

test("SCALE_GUARDRAILS: every entry parses against GuardrailSchema", () => {
  for (const g of SCALE_GUARDRAILS) {
    const result = GuardrailSchema.safeParse(g);
    assert.ok(result.success, `${g.id}: ${JSON.stringify(validateGuardrail(g))}`);
  }
});

test("SCALE_GUARDRAILS: every DEFERRED entry's riskId resolves to a real SCALE_RISK_REGISTER entry", () => {
  const riskIds = new Set(SCALE_RISK_REGISTER.map((r) => r.id));
  for (const g of SCALE_GUARDRAILS) {
    if (g.status !== "DEFERRED") continue;
    assert.ok(g.riskId, `${g.id}: DEFERRED but no riskId`);
    assert.ok(riskIds.has(g.riskId!), `${g.id}: riskId ${g.riskId} is not in SCALE_RISK_REGISTER`);
  }
});

test("SCALE_RISK_REGISTER: every entry parses against ScaleRiskSchema (owner, reason, phaseTarget all required)", () => {
  for (const r of SCALE_RISK_REGISTER) {
    const result = ScaleRiskSchema.safeParse(r);
    assert.ok(result.success, `${r.id}: ${JSON.stringify(validateScaleRisk(r))}`);
  }
});

test("SCALE_RISK_REGISTER: every DEFERRED guardrail has exactly one matching risk (no orphan risks)", () => {
  const usedRiskIds = new Set(SCALE_GUARDRAILS.filter((g) => g.riskId).map((g) => g.riskId));
  for (const r of SCALE_RISK_REGISTER) {
    assert.ok(usedRiskIds.has(r.id), `${r.id}: registered but no guardrail references it`);
  }
});
