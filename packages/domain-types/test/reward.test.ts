import assert from "node:assert/strict";
import { test } from "node:test";
import { RewardLedgerEntrySchema } from "../src/reward.js";

const FAMILY_ID = "11111111-1111-4111-8111-111111111111";
const CHILD_ID = "33333333-3333-4333-8333-333333333333";
const ASSIGNMENT_ID = "55555555-5555-4555-8555-555555555555";

test("a well-formed XP grant parses", () => {
  const entry = RewardLedgerEntrySchema.parse({
    rewardLedgerEntryId: "77777777-7777-4777-8777-777777777777",
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    kind: "XP",
    amount: 10,
    reason: "TASK_COMPLETION",
    sourceTaskAssignmentId: ASSIGNMENT_ID,
    idempotencyKey: "task-completion-55555555-approve",
    postedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(entry.kind, "XP");
  assert.equal(entry.amount, 10);
});

test("a redemption is representable as a negative amount", () => {
  const entry = RewardLedgerEntrySchema.parse({
    rewardLedgerEntryId: "88888888-8888-4888-8888-888888888888",
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    kind: "COINS",
    amount: -50,
    reason: "REWARD_REDEMPTION",
    idempotencyKey: "redemption-abc",
    postedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(entry.amount, -50);
});

test("there is no mutable balance field anywhere on the schema (append-only ledger)", () => {
  const shape = RewardLedgerEntrySchema.shape;
  assert.equal("balance" in shape, false);
});

test("rejects an unknown ledger kind", () => {
  assert.throws(() =>
    RewardLedgerEntrySchema.parse({
      rewardLedgerEntryId: "99999999-9999-4999-8999-999999999999",
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      kind: "POINTS",
      amount: 1,
      reason: "TASK_COMPLETION",
      idempotencyKey: "x",
      postedAt: "2026-01-01T00:00:00.000Z",
    }),
  );
});

test("rejects a write with no idempotency key", () => {
  assert.throws(() =>
    RewardLedgerEntrySchema.parse({
      rewardLedgerEntryId: "99999999-9999-4999-8999-999999999999",
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      kind: "XP",
      amount: 1,
      reason: "TASK_COMPLETION",
      idempotencyKey: "",
      postedAt: "2026-01-01T00:00:00.000Z",
    }),
  );
});
