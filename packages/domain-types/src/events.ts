import { z } from "zod";
import { ChildId, FamilyId } from "./ids.js";

/**
 * Envelope per docs/architecture/events.md. Delivery is at-least-once;
 * consumers must be idempotent. Payloads carry identifiers and minimal
 * data only -- "sensitive content should be fetched through authorized
 * services when necessary" (PII rule).
 */
export const EventEnvelopeSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.string(),
  occurredAt: z.string().datetime(),
  actorId: z.string(),
  familyId: FamilyId,
  childId: ChildId.optional(),
  aggregateId: z.string(),
  version: z.number().int().positive(),
  // zod 4 removed the single-argument z.record(valueSchema) overload -- the
  // key schema is mandatory now. z.record(z.string(), ...) spells out what
  // the one-argument form already meant in zod 3, so the envelope contract
  // is unchanged: string keys, unknown values.
  payload: z.record(z.string(), z.unknown()),
});
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;

/**
 * Subset of docs/architecture/events.md's "Initial events" relevant to
 * this contract pack's aggregates (Family/Task/Verification/Reward).
 * Social/messenger/game events are out of scope here (Phase 4+).
 *
 * PROGRESS_UPDATED and NOTIFICATION_REQUESTED (added by P1-014) are the
 * last two of docs/architecture/vertical-slice/task-to-reward.md's
 * "Required events" (TaskStarted, VerificationCompleted, TaskCompleted,
 * TaskRejected, RewardUnlocked, ProgressUpdated, NotificationRequested) --
 * the other five were already covered. Both are genuinely part of this
 * vertical slice's event path (docs/architecture/vertical-slice/api-and-events.md:
 * "TaskStarted -> VerificationCompleted -> TaskCompleted -> RewardUnlocked
 * -> ProgressUpdated -> NotificationRequested"), not Phase 4+ social scope.
 */
/**
 * Family lifecycle events added by P1-001. "Every membership mutation
 * produces an audit event" (docs/product/family-lifecycle.md). These were
 * flagged as a gap in the P0-009 family.ts comment; they are resolved here.
 */
export const FAMILY_EVENT_TYPES = [
  "FAMILY_CREATED",
  "CHILD_ADDED",
  "PARENT_INVITED",
  "PARENT_INVITATION_ACCEPTED",
  "PARENT_MEMBERSHIP_REVOKED",
] as const;
export type FamilyEventType = (typeof FAMILY_EVENT_TYPES)[number];

/**
 * Task lifecycle events added by P1-002A. Template publishing and child
 * submission events fill gaps in the original P0-009 list.
 */
export const TASK_EVENT_TYPES = [
  "TASK_TEMPLATE_CREATED",
  "TASK_TEMPLATE_PUBLISHED",
  "TASK_ASSIGNED",
  "TASK_STARTED",
  "TASK_SUBMITTED",
  "TASK_APPROVED",
  "TASK_REJECTED",
  "TASK_COMPLETED",
] as const;
export type TaskEventType = (typeof TASK_EVENT_TYPES)[number];

export const DOMAIN_EVENT_TYPES = [
  ...FAMILY_EVENT_TYPES,
  ...TASK_EVENT_TYPES,
  "VERIFICATION_COMPLETED",
  "XP_GRANTED",
  "COINS_GRANTED",
  "MONEY_LEDGER_POSTED",
  "REWARD_UNLOCKED",
  "REWARD_REDEEMED",
  "PROGRESS_UPDATED",
  "NOTIFICATION_REQUESTED",
] as const;
export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number];
