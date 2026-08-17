import { z } from "zod";
import { ChildId, FamilyId, ParentId, RewardLedgerEntryId, TaskAssignmentId } from "./ids.js";

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
  adjustedByParentId: ParentId.optional(),
  idempotencyKey: z.string().min(1),
  postedAt: z.string().datetime(),
});
export type RewardLedgerEntry = z.infer<typeof RewardLedgerEntrySchema>;
