import assert from "node:assert/strict";
import { test } from "node:test";
import { DOMAIN_EVENT_TYPES, EventEnvelopeSchema } from "../src/events.js";

const FAMILY_ID = "11111111-1111-4111-8111-111111111111";
const CHILD_ID = "33333333-3333-4333-8333-333333333333";

test("a well-formed event envelope parses", () => {
  const event = EventEnvelopeSchema.parse({
    eventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    eventType: "TASK_APPROVED",
    occurredAt: "2026-01-01T00:00:00.000Z",
    actorId: "parent-1",
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    aggregateId: "task-assignment-1",
    version: 1,
    payload: { note: "great job" },
  });
  assert.equal(event.eventType, "TASK_APPROVED");
});

test("DOMAIN_EVENT_TYPES only covers this contract pack's aggregates, not the full catalog", () => {
  assert.ok(DOMAIN_EVENT_TYPES.includes("TASK_APPROVED"));
  assert.ok(DOMAIN_EVENT_TYPES.includes("MONEY_LEDGER_POSTED"));
  // Social/messenger/game events from docs/architecture/events.md's full
  // list are deliberately not in this subset (Phase 4+ scope).
  assert.ok(!(DOMAIN_EVENT_TYPES as readonly string[]).includes("FRIENDSHIP_CHANGED"));
});

test("every vertical-slice required event (docs/architecture/vertical-slice/task-to-reward.md) has a matching type", () => {
  // TaskStarted, VerificationCompleted, TaskCompleted, TaskRejected,
  // RewardUnlocked, ProgressUpdated, NotificationRequested.
  const required = [
    "TASK_STARTED",
    "VERIFICATION_COMPLETED",
    "TASK_COMPLETED",
    "TASK_REJECTED",
    "REWARD_UNLOCKED",
    "PROGRESS_UPDATED",
    "NOTIFICATION_REQUESTED",
  ];
  for (const type of required) {
    assert.ok((DOMAIN_EVENT_TYPES as readonly string[]).includes(type), `missing required vertical-slice event ${type}`);
  }
});

test("childId is optional (not every event is child-scoped)", () => {
  const event = EventEnvelopeSchema.parse({
    eventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    eventType: "TASK_APPROVED",
    occurredAt: "2026-01-01T00:00:00.000Z",
    actorId: "parent-1",
    familyId: FAMILY_ID,
    aggregateId: "task-assignment-1",
    version: 1,
    payload: {},
  });
  assert.equal(event.childId, undefined);
});
