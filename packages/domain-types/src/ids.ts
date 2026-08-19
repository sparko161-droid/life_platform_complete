import { z } from "zod";

// UUID/UUIDv7 per docs/architecture/data-architecture.md ("IDs: Use
// UUID/UUIDv7 where supported. Public IDs must not reveal sequence
// information."). Branded so e.g. a ChildId can't be passed where a
// FamilyId is expected, even though both are plain strings at runtime.
function brandedUuid<Brand extends string>(_brand: Brand) {
  return z.string().uuid().brand<Brand>();
}

export const FamilyId = brandedUuid("FamilyId");
export const ParentId = brandedUuid("ParentId");
export const ChildId = brandedUuid("ChildId");
export const TaskTemplateId = brandedUuid("TaskTemplateId");
export const TaskAssignmentId = brandedUuid("TaskAssignmentId");
export const TaskCompletionId = brandedUuid("TaskCompletionId");
export const MediaEvidenceId = brandedUuid("MediaEvidenceId");
export const RewardLedgerEntryId = brandedUuid("RewardLedgerEntryId");
export const RewardId = brandedUuid("RewardId");
export const InvitationTokenId = brandedUuid("InvitationTokenId");
export const AccountId = brandedUuid("AccountId");
export const SessionId = brandedUuid("SessionId");

export type FamilyId = z.infer<typeof FamilyId>;
export type ParentId = z.infer<typeof ParentId>;
export type ChildId = z.infer<typeof ChildId>;
export type TaskTemplateId = z.infer<typeof TaskTemplateId>;
export type TaskAssignmentId = z.infer<typeof TaskAssignmentId>;
export type TaskCompletionId = z.infer<typeof TaskCompletionId>;
export type MediaEvidenceId = z.infer<typeof MediaEvidenceId>;
export type RewardLedgerEntryId = z.infer<typeof RewardLedgerEntryId>;
export type RewardId = z.infer<typeof RewardId>;
export type InvitationTokenId = z.infer<typeof InvitationTokenId>;
export type AccountId = z.infer<typeof AccountId>;
export type SessionId = z.infer<typeof SessionId>;
