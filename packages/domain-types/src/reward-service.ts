import { randomUUID } from "node:crypto";
import type { EventEnvelope } from "./events.js";
import type { ChildId, FamilyId, ParentId, RewardId, RewardLedgerEntryId } from "./ids.js";
import {
  type Reward,
  type RewardLedgerEntry,
  type RewardLedgerKind,
  type RewardStatus,
  RewardLedgerEntrySchema,
  RewardSchema,
  isValidRewardTransition,
} from "./reward.js";

/**
 * Reward ledger and catalog domain service (P1-006).
 *
 * Implements "Reward ledger and configurable N-day rewards"
 * (tasks/registry.yaml) as a pure domain layer: every function takes
 * current aggregate state and a command, returns the next state and the
 * events to be persisted. No I/O occurs here.
 *
 * Data rules:
 *   - "Never store mutable balance as sole truth. Use append-only ledger
 *     entries plus derived balance." (docs/architecture/data-architecture.md)
 *   - Idempotency: ledger writes carry an `idempotencyKey`; the
 *     application layer (repository) enforces uniqueness via DB constraints.
 *     The domain layer assists with duplicate detection when the current
 *     entry set is provided — see `postLedgerEntry`.
 *   - Reward reversals are compensating events, never destructive edits.
 *     (docs/game/rewards.md)
 *
 * Reward catalog lifecycle per docs/architecture/entity-lifecycle.md:
 *   LOCKED → AVAILABLE → REDEEMING → REDEEMED
 *   LOCKED/AVAILABLE → EXPIRED | CANCELLED (terminal)
 *
 * Events emitted:
 *   XP_GRANTED, COINS_GRANTED, MONEY_LEDGER_POSTED (ledger posts)
 *   REWARD_UNLOCKED, REWARD_REDEEMED (catalog transitions)
 *
 * Sources:
 *   - docs/game/rewards.md
 *   - docs/architecture/data-architecture.md
 *   - docs/architecture/entity-lifecycle.md
 *   - docs/architecture/events.md
 */

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class RewardDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RewardDomainError";
  }
}

// ---------------------------------------------------------------------------
// Balance
// ---------------------------------------------------------------------------

/**
 * Derives the current balance for a given ledger kind from the append-only
 * entry set. Balance is never stored — always computed.
 *
 * @param entries All ledger entries for one child within one family.
 * @param kind The currency to sum.
 */
export function computeBalance(entries: readonly RewardLedgerEntry[], kind: RewardLedgerKind): number {
  return entries.reduce((sum, e) => (e.kind === kind ? sum + e.amount : sum), 0);
}

// ---------------------------------------------------------------------------
// Idempotency helpers
// ---------------------------------------------------------------------------

/**
 * Checks whether an idempotency key already exists in the entry set.
 * Returns the existing entry if found (the caller should return it unchanged),
 * or undefined if this is a new write.
 *
 * This is the "read existing entries before writing" pattern:
 * the application layer loads all entries for the (childId, kind) pair
 * and passes them here so the domain can detect a duplicate before
 * creating a new record.
 */
export function findDuplicateEntry(
  existingEntries: readonly RewardLedgerEntry[],
  idempotencyKey: string,
): RewardLedgerEntry | undefined {
  return existingEntries.find((e) => e.idempotencyKey === idempotencyKey);
}

// ---------------------------------------------------------------------------
// Command types
// ---------------------------------------------------------------------------

export interface GrantTaskRewardCommand {
  familyId: FamilyId;
  childId: ChildId;
  sourceTaskAssignmentId: NonNullable<RewardLedgerEntry["sourceTaskAssignmentId"]>;
  /** XP to grant (0 to skip). */
  xpAmount: number;
  /** COINS to grant (0 to skip). */
  coinsAmount: number;
  /** ISO 8601 datetime supplied by the caller for determinism. */
  now: string;
}

export interface GrantStreakBonusCommand {
  familyId: FamilyId;
  childId: ChildId;
  kind: RewardLedgerKind;
  amount: number;
  /** Unique key per streak-bonus event; prevents double-granting on retry. */
  idempotencyKey: string;
  now: string;
}

export interface AdjustBalanceCommand {
  familyId: FamilyId;
  childId: ChildId;
  parentId: ParentId;
  kind: RewardLedgerKind;
  /** Signed integer: positive = grant, negative = deduction. */
  amount: number;
  idempotencyKey: string;
  now: string;
}

export interface InitiateRedemptionCommand {
  familyId: FamilyId;
  childId: ChildId;
  now: string;
}

export interface ConfirmRedemptionCommand {
  actorId: ParentId;
  now: string;
}

export interface CreateRewardCommand {
  rewardId: RewardId;
  familyId: FamilyId;
  createdByParentId: ParentId;
  title: string;
  type: Reward["type"];
  budgetLimitPerPeriod?: number;
  isOneUse?: boolean;
  now: string;
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface LedgerPostResult {
  entry: RewardLedgerEntry;
  events: EventEnvelope[];
  /** True when the entry was already present (idempotent replay). */
  duplicate: boolean;
}

export interface RewardCommandResult {
  next: Reward;
  events: EventEnvelope[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireRewardStatus(reward: Reward, expected: RewardStatus, op: string): void {
  if (reward.status !== expected) {
    throw new RewardDomainError(
      "INVALID_REWARD_STATUS",
      `${op} requires reward status ${expected}, got ${reward.status}`,
    );
  }
}

function requireRewardTransition(from: RewardStatus, to: RewardStatus, op: string): void {
  if (!isValidRewardTransition(from, to)) {
    throw new RewardDomainError(
      "INVALID_REWARD_TRANSITION",
      `${op}: invalid transition ${from} -> ${to}`,
    );
  }
}

function makeEntry(fields: Omit<RewardLedgerEntry, "rewardLedgerEntryId">): RewardLedgerEntry {
  return RewardLedgerEntrySchema.parse({
    rewardLedgerEntryId: randomUUID() as RewardLedgerEntryId,
    ...fields,
  });
}

function makeEventEnvelope(
  eventType: string,
  payload: Record<string, unknown>,
  actorId: string,
  now: string,
): EventEnvelope {
  return {
    eventType,
    payload,
    actorId,
    occurredAt: now,
  } as EventEnvelope;
}

// ---------------------------------------------------------------------------
// Ledger service functions
// ---------------------------------------------------------------------------

/**
 * Posts XP and/or COINS ledger entries after a task is approved.
 *
 * Idempotency: uses `sourceTaskAssignmentId` as the idempotency key for
 * each currency. If an entry with that key already exists in
 * `existingEntries`, it is returned unchanged (`duplicate: true`).
 *
 * @throws {RewardDomainError} INVALID_REWARD_AMOUNT if amounts are negative.
 */
export function grantTaskReward(
  existingEntries: readonly RewardLedgerEntry[],
  command: GrantTaskRewardCommand,
): { xp?: LedgerPostResult; coins?: LedgerPostResult } {
  if (command.xpAmount < 0 || command.coinsAmount < 0) {
    throw new RewardDomainError(
      "INVALID_REWARD_AMOUNT",
      "reward amounts must be non-negative",
    );
  }

  const result: { xp?: LedgerPostResult; coins?: LedgerPostResult } = {};

  if (command.xpAmount > 0) {
    const key = `task-completion:${command.sourceTaskAssignmentId}:XP`;
    const existing = findDuplicateEntry(existingEntries, key);
    if (existing) {
      result.xp = { entry: existing, events: [], duplicate: true };
    } else {
      const entry = makeEntry({
        familyId: command.familyId,
        childId: command.childId,
        kind: "XP",
        amount: command.xpAmount,
        reason: "TASK_COMPLETION",
        sourceTaskAssignmentId: command.sourceTaskAssignmentId,
        idempotencyKey: key,
        postedAt: command.now,
      });
      result.xp = {
        entry,
        events: [makeEventEnvelope("XP_GRANTED", { amount: command.xpAmount, entry }, command.childId, command.now)],
        duplicate: false,
      };
    }
  }

  if (command.coinsAmount > 0) {
    const key = `task-completion:${command.sourceTaskAssignmentId}:COINS`;
    const existing = findDuplicateEntry(existingEntries, key);
    if (existing) {
      result.coins = { entry: existing, events: [], duplicate: true };
    } else {
      const entry = makeEntry({
        familyId: command.familyId,
        childId: command.childId,
        kind: "COINS",
        amount: command.coinsAmount,
        reason: "TASK_COMPLETION",
        sourceTaskAssignmentId: command.sourceTaskAssignmentId,
        idempotencyKey: key,
        postedAt: command.now,
      });
      result.coins = {
        entry,
        events: [makeEventEnvelope("COINS_GRANTED", { amount: command.coinsAmount, entry }, command.childId, command.now)],
        duplicate: false,
      };
    }
  }

  return result;
}

/**
 * Posts a STREAK_BONUS ledger entry for N-day streak completions.
 * Idempotent: if the idempotencyKey already exists, returns the existing
 * entry with `duplicate: true`.
 *
 * @throws {RewardDomainError} INVALID_REWARD_AMOUNT if amount <= 0.
 */
export function grantStreakBonus(
  existingEntries: readonly RewardLedgerEntry[],
  command: GrantStreakBonusCommand,
): LedgerPostResult {
  if (command.amount <= 0) {
    throw new RewardDomainError(
      "INVALID_REWARD_AMOUNT",
      `streak bonus amount must be positive, got ${command.amount}`,
    );
  }

  const existing = findDuplicateEntry(existingEntries, command.idempotencyKey);
  if (existing) {
    return { entry: existing, events: [], duplicate: true };
  }

  const entry = makeEntry({
    familyId: command.familyId,
    childId: command.childId,
    kind: command.kind,
    amount: command.amount,
    reason: "STREAK_BONUS",
    idempotencyKey: command.idempotencyKey,
    postedAt: command.now,
  });

  const eventType = command.kind === "XP" ? "XP_GRANTED" : "COINS_GRANTED";
  return {
    entry,
    events: [makeEventEnvelope(eventType, { amount: command.amount, reason: "STREAK_BONUS", entry }, command.childId, command.now)],
    duplicate: false,
  };
}

/**
 * Posts a PARENT_ADJUSTMENT ledger entry (manual balance change by a
 * parent). Supports both positive (grants) and negative (deductions).
 * Idempotent via `idempotencyKey`.
 *
 * @throws {RewardDomainError} ADJUSTMENT_AMOUNT_ZERO if amount is 0.
 */
export function adjustBalance(
  existingEntries: readonly RewardLedgerEntry[],
  command: AdjustBalanceCommand,
): LedgerPostResult {
  if (command.amount === 0) {
    throw new RewardDomainError(
      "ADJUSTMENT_AMOUNT_ZERO",
      "adjustment amount must be non-zero",
    );
  }

  const existing = findDuplicateEntry(existingEntries, command.idempotencyKey);
  if (existing) {
    return { entry: existing, events: [], duplicate: true };
  }

  const entry = makeEntry({
    familyId: command.familyId,
    childId: command.childId,
    kind: command.kind,
    amount: command.amount,
    reason: "PARENT_ADJUSTMENT",
    adjustedByParentId: command.parentId,
    idempotencyKey: command.idempotencyKey,
    postedAt: command.now,
  });

  const eventType =
    command.kind === "MONEY"
      ? "MONEY_LEDGER_POSTED"
      : command.kind === "XP"
        ? "XP_GRANTED"
        : "COINS_GRANTED";

  return {
    entry,
    events: [makeEventEnvelope(eventType, { amount: command.amount, reason: "PARENT_ADJUSTMENT", entry }, command.parentId, command.now)],
    duplicate: false,
  };
}

// ---------------------------------------------------------------------------
// Reward catalog service functions
// ---------------------------------------------------------------------------

/**
 * Creates a new Reward catalog entry in LOCKED status.
 * The reward becomes visible to the child only once a parent activates it
 * (LOCKED → AVAILABLE).
 */
export function createReward(command: CreateRewardCommand): RewardCommandResult {
  const reward = RewardSchema.parse({
    rewardId: command.rewardId,
    familyId: command.familyId,
    createdByParentId: command.createdByParentId,
    title: command.title,
    type: command.type,
    status: "LOCKED" as RewardStatus,
    version: 1,
    ...(command.budgetLimitPerPeriod !== undefined
      ? { budgetLimitPerPeriod: command.budgetLimitPerPeriod }
      : {}),
    isOneUse: command.isOneUse ?? false,
    createdAt: command.now,
  });

  return { next: reward, events: [] };
}

/**
 * Activates a reward (LOCKED → AVAILABLE), making it visible and
 * redeemable by the child.
 *
 * @emits REWARD_UNLOCKED
 */
export function activateReward(reward: Reward, actorId: ParentId, now: string): RewardCommandResult {
  requireRewardTransition(reward.status, "AVAILABLE", "activateReward");
  const next = RewardSchema.parse({ ...reward, status: "AVAILABLE", version: reward.version + 1 });
  return {
    next,
    events: [makeEventEnvelope("REWARD_UNLOCKED", { rewardId: reward.rewardId }, actorId, now)],
  };
}

/**
 * Initiates a redemption (AVAILABLE → REDEEMING). The child triggers this;
 * the parent confirms or rejects it.
 *
 * @throws {RewardDomainError} INVALID_REWARD_STATUS if not AVAILABLE.
 */
export function initiateRedemption(
  reward: Reward,
  command: InitiateRedemptionCommand,
): RewardCommandResult {
  requireRewardStatus(reward, "AVAILABLE", "initiateRedemption");
  const next = RewardSchema.parse({ ...reward, status: "REDEEMING", version: reward.version + 1 });
  return { next, events: [] };
}

/**
 * Confirms a redemption (REDEEMING → REDEEMED). The parent confirms and the
 * domain posts a REWARD_REDEMPTION ledger entry.
 *
 * @emits REWARD_REDEEMED
 */
export function confirmRedemption(
  reward: Reward,
  existingEntries: readonly RewardLedgerEntry[],
  command: ConfirmRedemptionCommand & { familyId: FamilyId; childId: ChildId; idempotencyKey: string },
): { next: Reward; events: EventEnvelope[]; ledgerEntry: LedgerPostResult } {
  requireRewardStatus(reward, "REDEEMING", "confirmRedemption");

  const next = RewardSchema.parse({ ...reward, status: "REDEEMED", version: reward.version + 1 });

  const existing = findDuplicateEntry(existingEntries, command.idempotencyKey);
  let ledgerEntry: LedgerPostResult;
  if (existing) {
    ledgerEntry = { entry: existing, events: [], duplicate: true };
  } else {
    const entry = makeEntry({
      familyId: command.familyId,
      childId: command.childId,
      kind: "COINS",
      // Redemption is a consumption — negative amount for coin-cost rewards.
      // The actual amount/kind depends on the reward type; COINS is the
      // default currency for redemption; XP rewards are informational only.
      // For Phase 1 we record a 0-amount redemption event for non-currency
      // rewards as an audit trail; real money handling is deferred.
      amount: 0,
      reason: "REWARD_REDEMPTION",
      sourceRewardId: reward.rewardId,
      idempotencyKey: command.idempotencyKey,
      postedAt: command.now,
    });
    ledgerEntry = {
      entry,
      events: [makeEventEnvelope("REWARD_REDEEMED", { rewardId: reward.rewardId }, command.actorId, command.now)],
      duplicate: false,
    };
  }

  return {
    next,
    events: [makeEventEnvelope("REWARD_REDEEMED", { rewardId: reward.rewardId }, command.actorId, command.now)],
    ledgerEntry,
  };
}

/**
 * Cancels a redemption in progress (REDEEMING → AVAILABLE). Compensating
 * event: does not delete the REDEEMING state, transitions back.
 *
 * @throws {RewardDomainError} INVALID_REWARD_STATUS if not REDEEMING.
 */
export function cancelRedemption(
  reward: Reward,
  actorId: ParentId,
  now: string,
): RewardCommandResult {
  requireRewardStatus(reward, "REDEEMING", "cancelRedemption");
  const next = RewardSchema.parse({ ...reward, status: "AVAILABLE", version: reward.version + 1 });
  return { next, events: [] };
}

/**
 * Expires a reward (LOCKED|AVAILABLE → EXPIRED). Terminal state.
 */
export function expireReward(reward: Reward, actorId: ParentId, now: string): RewardCommandResult {
  requireRewardTransition(reward.status, "EXPIRED", "expireReward");
  const next = RewardSchema.parse({ ...reward, status: "EXPIRED", version: reward.version + 1 });
  return { next, events: [] };
}

/**
 * Cancels a reward (LOCKED|AVAILABLE → CANCELLED). Terminal state.
 */
export function cancelReward(reward: Reward, actorId: ParentId, now: string): RewardCommandResult {
  requireRewardTransition(reward.status, "CANCELLED", "cancelReward");
  const next = RewardSchema.parse({ ...reward, status: "CANCELLED", version: reward.version + 1 });
  return { next, events: [] };
}
