/**
 * Reward repository (P1-025).
 *
 * Like task-service.ts, reward-service.ts's catalog functions
 * (activateReward, confirmRedemption, cancelRedemption, expireReward,
 * cancelReward) take only a bare `Reward` (no Family), so they do not
 * self-enforce actor authorization either -- every one of them here
 * calls requireActiveParentMemberOrSystem first (closes RT-005).
 *
 * Ledger-posting functions (grantTaskReward, grantStreakBonus,
 * adjustBalance) are idempotency-key-checked against a real DB lookup
 * for the exact key the domain function will use (computed via the same
 * @life/domain-types key-derivation helpers, not a hand-rolled copy), so
 * the "existingEntries" the pure function sees always reflects the real
 * ledger.
 */
import type { PoolClient } from "pg";
import {
  type AdjustBalanceCommand,
  type ChildId,
  type ConfirmRedemptionCommand,
  type CreateRewardCommand,
  type FamilyId,
  type GrantStreakBonusCommand,
  type GrantTaskRewardCommand,
  type InitiateRedemptionCommand,
  type LedgerPostResult,
  type ParentId,
  type Reward,
  type RewardLedgerEntry,
  activateReward as activateRewardDomain,
  adjustBalance as adjustBalanceDomain,
  cancelRedemption as cancelRedemptionDomain,
  cancelReward as cancelRewardDomain,
  confirmRedemption as confirmRedemptionDomain,
  createReward as createRewardDomain,
  expireReward as expireRewardDomain,
  grantStreakBonus as grantStreakBonusDomain,
  grantTaskReward as grantTaskRewardDomain,
  initiateRedemption as initiateRedemptionDomain,
  taskCompletionRewardKey,
} from "@life/domain-types";
import { rowToReward, rowToRewardLedgerEntry } from "../db/rows.js";
import { requireActiveParentMemberOrSystem } from "./auth.js";
import { RepositoryConflictError, RepositoryNotFoundError } from "./errors.js";

async function loadReward(client: PoolClient, rewardId: string): Promise<Reward | null> {
  const { rows } = await client.query(
    "SELECT reward_id, family_id, created_by_parent_id, title, type, status, version, budget_limit_per_period, is_one_use, created_at FROM rewards WHERE reward_id = $1 FOR UPDATE",
    [rewardId],
  );
  return rows[0] ? rowToReward(rows[0]) : null;
}

async function saveReward(client: PoolClient, next: Reward, expectedVersion: number): Promise<void> {
  const result = await client.query("UPDATE rewards SET status = $1, version = $2 WHERE reward_id = $3 AND version = $4", [
    next.status,
    next.version,
    next.rewardId,
    expectedVersion,
  ]);
  if (result.rowCount === 0) throw new RepositoryConflictError("Reward", next.rewardId);
}

async function loadLedgerEntryByKey(client: PoolClient, idempotencyKey: string): Promise<RewardLedgerEntry[]> {
  const { rows } = await client.query(
    "SELECT reward_ledger_entry_id, family_id, child_id, kind, amount, reason, source_task_assignment_id, source_reward_id, adjusted_by_parent_id, idempotency_key, posted_at FROM reward_ledger_entries WHERE idempotency_key = $1",
    [idempotencyKey],
  );
  return rows.map(rowToRewardLedgerEntry);
}

async function insertLedgerEntry(client: PoolClient, entry: RewardLedgerEntry): Promise<void> {
  // ON CONFLICT DO NOTHING: the idempotency_key UNIQUE constraint (P1-024)
  // is the real defense-in-depth against a race the loadLedgerEntryByKey
  // check above could in principle lose -- two concurrent transactions
  // both querying "not found" before either commits. This makes that race
  // safe rather than a 500.
  await client.query(
    `INSERT INTO reward_ledger_entries
       (reward_ledger_entry_id, family_id, child_id, kind, amount, reason, source_task_assignment_id, source_reward_id, adjusted_by_parent_id, idempotency_key, posted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (idempotency_key) DO NOTHING`,
    [
      entry.rewardLedgerEntryId,
      entry.familyId,
      entry.childId,
      entry.kind,
      entry.amount,
      entry.reason,
      entry.sourceTaskAssignmentId ?? null,
      entry.sourceRewardId ?? null,
      entry.adjustedByParentId ?? null,
      entry.idempotencyKey,
      entry.postedAt,
    ],
  );
}

export async function grantTaskReward(
  client: PoolClient,
  command: GrantTaskRewardCommand,
): Promise<{ xp?: LedgerPostResult; coins?: LedgerPostResult }> {
  const existing: RewardLedgerEntry[] = [];
  if (command.xpAmount > 0) {
    existing.push(...(await loadLedgerEntryByKey(client, taskCompletionRewardKey(command.sourceTaskAssignmentId, "XP"))));
  }
  if (command.coinsAmount > 0) {
    existing.push(...(await loadLedgerEntryByKey(client, taskCompletionRewardKey(command.sourceTaskAssignmentId, "COINS"))));
  }
  const result = grantTaskRewardDomain(existing, command);
  if (result.xp && !result.xp.duplicate) await insertLedgerEntry(client, result.xp.entry);
  if (result.coins && !result.coins.duplicate) await insertLedgerEntry(client, result.coins.entry);
  return result;
}

export async function grantStreakBonus(client: PoolClient, command: GrantStreakBonusCommand): Promise<LedgerPostResult> {
  const existing = await loadLedgerEntryByKey(client, command.idempotencyKey);
  const result = grantStreakBonusDomain(existing, command);
  if (!result.duplicate) await insertLedgerEntry(client, result.entry);
  return result;
}

export async function adjustBalance(client: PoolClient, command: AdjustBalanceCommand): Promise<LedgerPostResult> {
  await requireActiveParentMemberOrSystem(client, command.familyId, command.parentId);
  const existing = await loadLedgerEntryByKey(client, command.idempotencyKey);
  const result = adjustBalanceDomain(existing, command);
  if (!result.duplicate) await insertLedgerEntry(client, result.entry);
  return result;
}

export async function createReward(client: PoolClient, command: CreateRewardCommand): Promise<Reward> {
  await requireActiveParentMemberOrSystem(client, command.familyId, command.createdByParentId);
  const { next } = createRewardDomain(command);
  await client.query(
    `INSERT INTO rewards (reward_id, family_id, created_by_parent_id, title, type, status, version, budget_limit_per_period, is_one_use, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [next.rewardId, next.familyId, next.createdByParentId, next.title, next.type, next.status, next.version, next.budgetLimitPerPeriod ?? null, next.isOneUse, next.createdAt],
  );
  return next;
}

export async function activateReward(client: PoolClient, rewardId: string, actorId: string, now: string): Promise<Reward> {
  const reward = await loadReward(client, rewardId);
  if (!reward) throw new RepositoryNotFoundError("Reward", rewardId);
  await requireActiveParentMemberOrSystem(client, reward.familyId, actorId);
  const { next } = activateRewardDomain(reward, actorId as ParentId, now);
  await saveReward(client, next, reward.version);
  return next;
}

export async function initiateRedemption(
  client: PoolClient,
  rewardId: string,
  command: InitiateRedemptionCommand,
): Promise<Reward> {
  const reward = await loadReward(client, rewardId);
  if (!reward) throw new RepositoryNotFoundError("Reward", rewardId);
  // Child-initiated: no parent-membership check here on purpose --
  // docs/architecture/concurrency-and-conflicts.md describes this as the
  // child's own action, confirmed server-side only at confirmRedemption.
  const { next } = initiateRedemptionDomain(reward, command);
  await saveReward(client, next, reward.version);
  return next;
}

export async function confirmRedemption(
  client: PoolClient,
  rewardId: string,
  command: ConfirmRedemptionCommand & { familyId: FamilyId; childId: ChildId; idempotencyKey: string },
): Promise<{ reward: Reward; ledgerEntry: LedgerPostResult }> {
  const reward = await loadReward(client, rewardId);
  if (!reward) throw new RepositoryNotFoundError("Reward", rewardId);
  // Closes RT-005: confirmRedemption previously accepted any actorId.
  await requireActiveParentMemberOrSystem(client, reward.familyId, command.actorId);
  const existing = await loadLedgerEntryByKey(client, command.idempotencyKey);
  const { next, ledgerEntry } = confirmRedemptionDomain(reward, existing, command);
  await saveReward(client, next, reward.version);
  if (!ledgerEntry.duplicate) await insertLedgerEntry(client, ledgerEntry.entry);
  return { reward: next, ledgerEntry };
}

export async function cancelRedemption(client: PoolClient, rewardId: string, actorId: string, now: string): Promise<Reward> {
  const reward = await loadReward(client, rewardId);
  if (!reward) throw new RepositoryNotFoundError("Reward", rewardId);
  await requireActiveParentMemberOrSystem(client, reward.familyId, actorId);
  const { next } = cancelRedemptionDomain(reward, actorId as ParentId, now);
  await saveReward(client, next, reward.version);
  return next;
}

export async function expireReward(client: PoolClient, rewardId: string, actorId: string, now: string): Promise<Reward> {
  const reward = await loadReward(client, rewardId);
  if (!reward) throw new RepositoryNotFoundError("Reward", rewardId);
  await requireActiveParentMemberOrSystem(client, reward.familyId, actorId);
  const { next } = expireRewardDomain(reward, actorId as ParentId, now);
  await saveReward(client, next, reward.version);
  return next;
}

export async function cancelReward(client: PoolClient, rewardId: string, actorId: string, now: string): Promise<Reward> {
  const reward = await loadReward(client, rewardId);
  if (!reward) throw new RepositoryNotFoundError("Reward", rewardId);
  await requireActiveParentMemberOrSystem(client, reward.familyId, actorId);
  const { next } = cancelRewardDomain(reward, actorId as ParentId, now);
  await saveReward(client, next, reward.version);
  return next;
}

export { loadReward };
