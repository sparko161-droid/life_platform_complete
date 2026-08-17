import { z } from "zod";
import { ChildId, FamilyId, ParentId, RewardId, RewardLedgerEntryId, TaskAssignmentId } from "./ids.js";
import type { ClassificationMap } from "./classification.js";

/**
 * Ownership: Economy/Reward domain. `docs/MASTER_SPEC.md` §12: "XP,
 * Coins, Money Ledger, Coupons, Levels, Streaks, Skills, Achievements and
 * Game Sessions are separate concepts." This contract covers the three
 * reward currencies as distinct, non-fungible ledger entry kinds — never
 * a single generic "points" field.
 * Data rule: "Never store mutable balance as sole truth. Use append-only
 * ledger entries plus derived balance." (docs/architecture/data-architecture.md)
 * -- there is deliberately no `balance` field anywhere in this contract;
 * balance is always computed by summing entries.
 */
export const REWARD_LEDGER_KINDS = ["XP", "COINS", "MONEY"] as const;
export type RewardLedgerKind = (typeof REWARD_LEDGER_KINDS)[number];

/**
 * Money policy (amount precision, currency, real-money redemption rules)
 * is flagged as a blocking decision in tasks/packets/P0-009-phase1-contract-pack.md
 * ("Blocking decisions: Money policy...") and is NOT resolved by this
 * contract -- `amount` for MONEY entries is an integer minor-unit count
 * (e.g. kopecks) as a placeholder convention only. Confirm with the Human
 * Architect before P1-006 implements real money handling.
 */
export const REWARD_LEDGER_REASONS = [
  "TASK_COMPLETION",
  "PARENT_ADJUSTMENT",
  "REWARD_REDEMPTION",
  "STREAK_BONUS",
] as const;
export type RewardLedgerReason = (typeof REWARD_LEDGER_REASONS)[number];

/**
 * Authorization: written only by the Economy domain service in response
 * to a domain event (TASK_APPROVED -> XP_GRANTED/COINS_GRANTED, or a
 * parent-initiated adjustment) — never inserted directly by a client.
 * Idempotency: writes use idempotency keys per
 * docs/architecture/api-contracts.md ("money ledger writes" is
 * explicitly listed). Events: XP_GRANTED, COINS_GRANTED,
 * MONEY_LEDGER_POSTED (docs/architecture/events.md).
 */
export const RewardLedgerEntrySchema = z.object({
  rewardLedgerEntryId: RewardLedgerEntryId,
  familyId: FamilyId,
  childId: ChildId,
  kind: z.enum(REWARD_LEDGER_KINDS),
  // Signed: positive for grants, negative for redemptions/deductions.
  amount: z.number().int(),
  reason: z.enum(REWARD_LEDGER_REASONS),
  sourceTaskAssignmentId: TaskAssignmentId.optional(),
  // Added in 0.2.0 (P0-009 revalidation): links a REWARD_REDEMPTION entry
  // back to the catalog Reward it redeemed, per docs/game/rewards.md
  // ("Coupon redemption is auditable"). Optional because TASK_COMPLETION/
  // STREAK_BONUS/PARENT_ADJUSTMENT entries have no catalog reward.
  sourceRewardId: RewardId.optional(),
  adjustedByParentId: ParentId.optional(),
  idempotencyKey: z.string().min(1),
  postedAt: z.string().datetime(),
});
export type RewardLedgerEntry = z.infer<typeof RewardLedgerEntrySchema>;

export const REWARD_LEDGER_ENTRY_CLASSIFICATION: ClassificationMap<keyof RewardLedgerEntry> = {
  rewardLedgerEntryId: "CHILD_PRIVATE",
  familyId: "FAMILY",
  childId: "CHILD_PRIVATE",
  kind: "CHILD_PRIVATE",
  // Money-kind entries carry more consequence than XP/coins, but the kind
  // itself (not the schema) determines whether real money is involved;
  // this map is per-field, so `amount`/`kind` land in the same class as
  // the rest of the record. SENSITIVE is reserved for safety/moderation/
  // learning-evidence records per data-classification.md's own examples,
  // not for money movement -- family-scoped is the correct class here.
  amount: "FAMILY",
  reason: "CHILD_PRIVATE",
  sourceTaskAssignmentId: "CHILD_PRIVATE",
  sourceRewardId: "CHILD_PRIVATE",
  adjustedByParentId: "FAMILY",
  idempotencyKey: "FAMILY",
  postedAt: "CHILD_PRIVATE",
};

/**
 * Reward catalog entity — new in 0.2.0 (P0-009 revalidation,
 * docs/planning/change-log.md 0.5). docs/game/rewards.md landed after the
 * 0.1.0 contract pack: "Reward is a typed entitlement, separate from task
 * completion and economy," with its own type list and lifecycle,
 * distinct from RewardLedgerEntry above (which only records a currency
 * movement, not what non-currency entitlement was defined or redeemed).
 */
export const REWARD_TYPES = [
  "XP",
  "COINS",
  "MONEY",
  "SCREEN_TIME",
  "DEVICE_TIME",
  "COUPON",
  "ACTIVITY",
  "FAMILY",
  "CUSTOM",
] as const;
export type RewardType = (typeof REWARD_TYPES)[number];

// docs/architecture/entity-lifecycle.md: "## Reward
// `LOCKED → AVAILABLE → REDEEMING → REDEEMED`; alternative terminal
// states are `EXPIRED` and `CANCELLED`."
export const REWARD_STATUSES = [
  "LOCKED",
  "AVAILABLE",
  "REDEEMING",
  "REDEEMED",
  "EXPIRED",
  "CANCELLED",
] as const;
export type RewardStatus = (typeof REWARD_STATUSES)[number];

const REWARD_TRANSITIONS: Record<RewardStatus, RewardStatus[]> = {
  LOCKED: ["AVAILABLE", "EXPIRED", "CANCELLED"],
  AVAILABLE: ["REDEEMING", "EXPIRED", "CANCELLED"],
  REDEEMING: ["REDEEMED", "AVAILABLE", "CANCELLED"], // AVAILABLE: a failed/abandoned redemption attempt returns here, not straight back to LOCKED, per "reward reversals are compensating events, never destructive edits" (docs/game/rewards.md).
  REDEEMED: [],
  EXPIRED: [],
  CANCELLED: [],
};
export function isValidRewardTransition(from: RewardStatus, to: RewardStatus): boolean {
  return from !== to && (REWARD_TRANSITIONS[from]?.includes(to) ?? false);
}

/**
 * Authorization: defined by a parent with the MONEY_REWARDS capability
 * (family.ts PARENT_CAPABILITIES); a child can only move
 * AVAILABLE->REDEEMING (initiate redemption) and never sets `status`
 * directly to REDEEMED -- that transition is server-confirmed only, per
 * docs/architecture/concurrency-and-conflicts.md ("Reward deleted while
 * child redeems: redemption is accepted or rejected atomically by
 * current reward state"). `version`: optimistic concurrency, same
 * rationale as Family/TaskAssignment. Events: REWARD_UNLOCKED,
 * REWARD_REDEEMED (docs/architecture/events.md); ledger linkage via
 * RewardLedgerEntry.sourceRewardId above.
 */
export const RewardSchema = z.object({
  rewardId: RewardId,
  familyId: FamilyId,
  createdByParentId: ParentId,
  title: z.string().min(1).max(120),
  type: z.enum(REWARD_TYPES),
  status: z.enum(REWARD_STATUSES),
  version: z.number().int().positive(),
  // docs/game/rewards.md: "Parent budget and per-day/per-period limits
  // apply before activation." Left as an optional count, not a full
  // recurrence rule -- the Rules DSL (P0-010) owns richer scheduling.
  budgetLimitPerPeriod: z.number().int().positive().optional(),
  isOneUse: z.boolean().default(false),
  createdAt: z.string().datetime(),
});
export type Reward = z.infer<typeof RewardSchema>;

export const REWARD_CLASSIFICATION: ClassificationMap<keyof Reward> = {
  rewardId: "FAMILY",
  familyId: "FAMILY",
  createdByParentId: "FAMILY",
  title: "FAMILY",
  type: "FAMILY",
  status: "FAMILY",
  version: "FAMILY",
  budgetLimitPerPeriod: "FAMILY",
  isOneUse: "FAMILY",
  createdAt: "FAMILY",
};
