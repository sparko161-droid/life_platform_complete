import assert from "node:assert/strict";
import { test } from "node:test";
import { RewardLedgerEntrySchema, RewardSchema, isValidRewardTransition } from "../src/reward.js";

const FAMILY_ID = "11111111-1111-4111-8111-111111111111";
const PARENT_ID = "22222222-2222-4222-8222-222222222222";
const CHILD_ID = "33333333-3333-4333-8333-333333333333";
const ASSIGNMENT_ID = "55555555-5555-4555-8555-555555555555";
const REWARD_ID = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";

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

test("a redemption entry can link back to the catalog Reward it redeemed", () => {
  const entry = RewardLedgerEntrySchema.parse({
    rewardLedgerEntryId: "bbbbbbbb-8888-4888-8888-888888888888",
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    kind: "COINS", // ledger kind is always a currency; COUPON/ACTIVITY/etc are Reward.type values, not ledger kinds
    amount: -20,
    reason: "REWARD_REDEMPTION",
    sourceRewardId: REWARD_ID,
    idempotencyKey: "redemption-linked",
    postedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(entry.sourceRewardId, REWARD_ID);
});

test("a well-formed reward catalog entry parses", () => {
  const reward = RewardSchema.parse({
    rewardId: REWARD_ID,
    familyId: FAMILY_ID,
    createdByParentId: PARENT_ID,
    title: "Поход в кино",
    type: "ACTIVITY",
    status: "AVAILABLE",
    version: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(reward.type, "ACTIVITY");
});

test("reward catalog entry rejects an unknown type", () => {
  assert.throws(() =>
    RewardSchema.parse({
      rewardId: REWARD_ID,
      familyId: FAMILY_ID,
      createdByParentId: PARENT_ID,
      title: "x",
      type: "STICKER",
      status: "AVAILABLE",
      version: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
    }),
  );
});

test("reward transitions follow entity-lifecycle.md: LOCKED -> AVAILABLE -> REDEEMING -> REDEEMED, with EXPIRED/CANCELLED as alternative terminals", () => {
  assert.equal(isValidRewardTransition("LOCKED", "AVAILABLE"), true);
  assert.equal(isValidRewardTransition("LOCKED", "REDEEMED"), false);
  assert.equal(isValidRewardTransition("AVAILABLE", "REDEEMING"), true);
  assert.equal(isValidRewardTransition("REDEEMING", "REDEEMED"), true);
  assert.equal(isValidRewardTransition("REDEEMING", "AVAILABLE"), true); // abandoned/failed redemption, compensating, not destructive
  assert.equal(isValidRewardTransition("AVAILABLE", "EXPIRED"), true);
  assert.equal(isValidRewardTransition("AVAILABLE", "CANCELLED"), true);
  assert.equal(isValidRewardTransition("REDEEMED", "AVAILABLE"), false);
});
