import { z } from "zod";
import { ChildId, FamilyId, ParentId } from "./ids.js";

/**
 * Ownership: Family domain (docs/architecture/domain-map.md — "Identity/
 * Family precedes nearly all domains"). Security boundary: "Family is the
 * security boundary for child data" (docs/product/actors-and-permissions.md).
 * Contract version: 0.1.0 (P0-009). Events: none of its own yet in
 * docs/architecture/events.md's initial list — membership mutations are
 * audited (family-lifecycle.md) but not yet in the domain event catalog;
 * flagged as a gap for whoever implements P1-001.
 */
export const CONTRACT_VERSION = "0.1.0";

// docs/product/family-lifecycle.md ("## States").
export const FAMILY_STATUSES = ["PENDING_INVITE", "ACTIVE", "SUSPENDED", "ARCHIVED"] as const;
export type FamilyStatus = (typeof FAMILY_STATUSES)[number];

const FAMILY_TRANSITIONS: Record<FamilyStatus, FamilyStatus[]> = {
  PENDING_INVITE: ["ACTIVE"],
  ACTIVE: ["SUSPENDED", "ARCHIVED"],
  SUSPENDED: ["ACTIVE", "ARCHIVED"],
  ARCHIVED: [],
};
export function isValidFamilyTransition(from: FamilyStatus, to: FamilyStatus): boolean {
  return from !== to && (FAMILY_TRANSITIONS[from]?.includes(to) ?? false);
}

/**
 * Sensitive, capability-gated actions per family-lifecycle.md ("Parent
 * roles are capability-based, not simply boolean admin flags. Sensitive
 * capabilities include child policy, money/rewards, social permissions,
 * chat visibility and account deletion.").
 */
export const PARENT_CAPABILITIES = [
  "CHILD_POLICY",
  "MONEY_REWARDS",
  "SOCIAL_PERMISSIONS",
  "CHAT_VISIBILITY",
  "ACCOUNT_DELETION",
] as const;
export type ParentCapability = (typeof PARENT_CAPABILITIES)[number];

// Not enumerated verbatim in family-lifecycle.md; inferred from "invitee
// must authenticate, accept and complete required consent/verification
// before membership becomes ACTIVE" and "Revocation immediately
// invalidates protected access tokens/session grants." Flagged as an
// inference, not a direct quote, for whoever implements P1-001 to confirm.
export const PARENT_MEMBERSHIP_STATUSES = ["INVITED", "ACTIVE", "REVOKED"] as const;
export type ParentMembershipStatus = (typeof PARENT_MEMBERSHIP_STATUSES)[number];

/**
 * Authorization: a ParentMembership's `capabilities` gate sensitive
 * actions (see PARENT_CAPABILITIES doc above). `isFamilyOwner` implies
 * all capabilities regardless of the explicit set — ownership cannot be
 * downgraded by omission. Only ACTIVE memberships may exercise any
 * capability.
 */
export const ParentMembershipSchema = z.object({
  parentId: ParentId,
  familyId: FamilyId,
  status: z.enum(PARENT_MEMBERSHIP_STATUSES),
  isFamilyOwner: z.boolean(),
  capabilities: z.array(z.enum(PARENT_CAPABILITIES)),
  invitedAt: z.string().datetime(),
  activatedAt: z.string().datetime().optional(),
  revokedAt: z.string().datetime().optional(),
});
export type ParentMembership = z.infer<typeof ParentMembershipSchema>;

/**
 * "Keep child PII minimal" (docs/architecture/data-architecture.md).
 * birthYear (not a full birthdate) and no contact info here by design —
 * children don't have independent login credentials at this layer.
 */
export const ChildProfileSchema = z.object({
  childId: ChildId,
  familyId: FamilyId,
  displayName: z.string().min(1).max(80),
  birthYear: z.number().int().min(2000).max(2030),
  avatarId: z.string().optional(),
});
export type ChildProfile = z.infer<typeof ChildProfileSchema>;

export const FamilySchema = z.object({
  familyId: FamilyId,
  status: z.enum(FAMILY_STATUSES),
  createdAt: z.string().datetime(),
  parents: z.array(ParentMembershipSchema).min(1),
  children: z.array(ChildProfileSchema),
});
export type Family = z.infer<typeof FamilySchema>;
