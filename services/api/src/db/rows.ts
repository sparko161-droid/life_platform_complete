/**
 * snake_case DB row <-> camelCase @life/domain-types aggregate mappers
 * (P1-025). The migration (P1-024) is the physical schema; these are the
 * only place that knows both shapes, so a column rename only touches
 * this file, not every repository method.
 */
import type {
  ChildProfile,
  Family,
  ParentMembership,
  Reward,
  RewardLedgerEntry,
  TaskAssignment,
  TaskCompletion,
  TaskTemplate,
} from "@life/domain-types";

const iso = (d: Date | string): string => (d instanceof Date ? d.toISOString() : d);

export function rowToParentMembership(row: {
  family_id: string;
  parent_id: string;
  status: string;
  is_family_owner: boolean;
  capabilities: string[];
  invited_at: Date | string;
  activated_at: Date | string | null;
  revoked_at: Date | string | null;
}): ParentMembership {
  return {
    parentId: row.parent_id as ParentMembership["parentId"],
    familyId: row.family_id as ParentMembership["familyId"],
    status: row.status as ParentMembership["status"],
    isFamilyOwner: row.is_family_owner,
    capabilities: row.capabilities as ParentMembership["capabilities"],
    invitedAt: iso(row.invited_at),
    ...(row.activated_at ? { activatedAt: iso(row.activated_at) } : {}),
    ...(row.revoked_at ? { revokedAt: iso(row.revoked_at) } : {}),
  };
}

export function rowToChildProfile(row: {
  child_id: string;
  family_id: string;
  display_name: string;
  birth_year: number;
  avatar_id: string | null;
}): ChildProfile {
  return {
    childId: row.child_id as ChildProfile["childId"],
    familyId: row.family_id as ChildProfile["familyId"],
    displayName: row.display_name,
    birthYear: row.birth_year,
    ...(row.avatar_id ? { avatarId: row.avatar_id } : {}),
  };
}

export function rowToFamily(
  familyRow: { family_id: string; status: string; version: number; created_at: Date | string },
  parentRows: Parameters<typeof rowToParentMembership>[0][],
  childRows: Parameters<typeof rowToChildProfile>[0][],
): Family {
  return {
    familyId: familyRow.family_id as Family["familyId"],
    status: familyRow.status as Family["status"],
    version: familyRow.version,
    createdAt: iso(familyRow.created_at),
    parents: parentRows.map(rowToParentMembership),
    children: childRows.map(rowToChildProfile),
  };
}

export function rowToTaskTemplate(row: {
  task_template_id: string;
  family_id: string;
  created_by_parent_id: string;
  title: string;
  verification_strategy: string;
  reward_xp: number;
  reward_coins: number;
  status: string;
  version: number;
  created_at: Date | string;
}): TaskTemplate {
  return {
    taskTemplateId: row.task_template_id as TaskTemplate["taskTemplateId"],
    familyId: row.family_id as TaskTemplate["familyId"],
    createdByParentId: row.created_by_parent_id as TaskTemplate["createdByParentId"],
    title: row.title,
    verificationStrategy: row.verification_strategy as TaskTemplate["verificationStrategy"],
    rewardXp: row.reward_xp,
    rewardCoins: row.reward_coins,
    status: row.status as TaskTemplate["status"],
    version: row.version,
    createdAt: iso(row.created_at),
  };
}

export function rowToTaskAssignment(row: {
  task_assignment_id: string;
  task_template_id: string;
  family_id: string;
  assigned_to_child_id: string;
  status: string;
  version: number;
  assigned_at: Date | string;
  due_at: Date | string | null;
}): TaskAssignment {
  return {
    taskAssignmentId: row.task_assignment_id as TaskAssignment["taskAssignmentId"],
    taskTemplateId: row.task_template_id as TaskAssignment["taskTemplateId"],
    familyId: row.family_id as TaskAssignment["familyId"],
    assignedToChildId: row.assigned_to_child_id as TaskAssignment["assignedToChildId"],
    status: row.status as TaskAssignment["status"],
    version: row.version,
    assignedAt: iso(row.assigned_at),
    ...(row.due_at ? { dueAt: iso(row.due_at) } : {}),
  };
}

export function rowToTaskCompletion(row: {
  task_completion_id: string;
  task_assignment_id: string;
  child_id: string;
  submitted_at: Date | string;
  media_evidence_id: string | null;
  counter_value: number | null;
  timer_seconds: number | null;
  self_report_note: string | null;
}): TaskCompletion {
  return {
    taskCompletionId: row.task_completion_id as TaskCompletion["taskCompletionId"],
    taskAssignmentId: row.task_assignment_id as TaskCompletion["taskAssignmentId"],
    childId: row.child_id as TaskCompletion["childId"],
    submittedAt: iso(row.submitted_at),
    ...(row.media_evidence_id ? { mediaEvidenceId: row.media_evidence_id as TaskCompletion["mediaEvidenceId"] } : {}),
    ...(row.counter_value !== null ? { counterValue: row.counter_value } : {}),
    ...(row.timer_seconds !== null ? { timerSeconds: row.timer_seconds } : {}),
    ...(row.self_report_note !== null ? { selfReportNote: row.self_report_note } : {}),
  };
}

export function rowToReward(row: {
  reward_id: string;
  family_id: string;
  created_by_parent_id: string;
  title: string;
  type: string;
  status: string;
  version: number;
  budget_limit_per_period: number | null;
  is_one_use: boolean;
  created_at: Date | string;
}): Reward {
  return {
    rewardId: row.reward_id as Reward["rewardId"],
    familyId: row.family_id as Reward["familyId"],
    createdByParentId: row.created_by_parent_id as Reward["createdByParentId"],
    title: row.title,
    type: row.type as Reward["type"],
    status: row.status as Reward["status"],
    version: row.version,
    ...(row.budget_limit_per_period !== null ? { budgetLimitPerPeriod: row.budget_limit_per_period } : {}),
    isOneUse: row.is_one_use,
    createdAt: iso(row.created_at),
  };
}

export function rowToRewardLedgerEntry(row: {
  reward_ledger_entry_id: string;
  family_id: string;
  child_id: string;
  kind: string;
  amount: number;
  reason: string;
  source_task_assignment_id: string | null;
  source_reward_id: string | null;
  adjusted_by_parent_id: string | null;
  idempotency_key: string;
  posted_at: Date | string;
}): RewardLedgerEntry {
  return {
    rewardLedgerEntryId: row.reward_ledger_entry_id as RewardLedgerEntry["rewardLedgerEntryId"],
    familyId: row.family_id as RewardLedgerEntry["familyId"],
    childId: row.child_id as RewardLedgerEntry["childId"],
    kind: row.kind as RewardLedgerEntry["kind"],
    amount: row.amount,
    reason: row.reason as RewardLedgerEntry["reason"],
    ...(row.source_task_assignment_id
      ? { sourceTaskAssignmentId: row.source_task_assignment_id as RewardLedgerEntry["sourceTaskAssignmentId"] }
      : {}),
    ...(row.source_reward_id ? { sourceRewardId: row.source_reward_id as RewardLedgerEntry["sourceRewardId"] } : {}),
    ...(row.adjusted_by_parent_id
      ? { adjustedByParentId: row.adjusted_by_parent_id as RewardLedgerEntry["adjustedByParentId"] }
      : {}),
    idempotencyKey: row.idempotency_key,
    postedAt: iso(row.posted_at),
  };
}
