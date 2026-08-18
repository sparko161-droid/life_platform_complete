import { z } from "zod";
import { ChildId, FamilyId, InvitationTokenId, ParentId } from "./ids.js";
import type { ClassificationMap } from "./classification.js";

/**
 * Ownership: Family domain (docs/architecture/domain-map.md — "Identity/
 * Family precedes nearly all domains"). Security boundary: "Family is the
 * security boundary for child data" (docs/product/actors-and-permissions.md).
 * Contract version: 0.2.0 (P0-009 revalidation, docs/planning/change-log.md
 * 0.5) — bumped from 0.1.0 to add optimistic-concurrency `version` and
 * data-classification maps, per docs/architecture/concurrency-and-conflicts.md
 * and docs/security/data-classification.md, neither of which existed when
 * 0.1.0 was written. Events: none of its own yet in
 * docs/architecture/events.md's initial list — membership mutations are
 * audited (family-lifecycle.md) but not yet in the domain event catalog;
 * flagged as a gap for whoever implements P1-001.
 */
export const CONTRACT_VERSION = "0.2.0";

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

/** docs/security/data-classification.md. Parent identity/membership state
 * is scoped to the owning family, not publicly visible. */
export const PARENT_MEMBERSHIP_CLASSIFICATION: ClassificationMap<keyof ParentMembership> = {
  parentId: "FAMILY",
  familyId: "FAMILY",
  status: "FAMILY",
  isFamilyOwner: "FAMILY",
  capabilities: "FAMILY",
  invitedAt: "FAMILY",
  activatedAt: "FAMILY",
  revokedAt: "FAMILY",
};

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

/** Child-associated data defaults to CHILD_PRIVATE per
 * docs/security/data-classification.md's example list. */
export const CHILD_PROFILE_CLASSIFICATION: ClassificationMap<keyof ChildProfile> = {
  childId: "CHILD_PRIVATE",
  familyId: "FAMILY",
  displayName: "CHILD_PRIVATE",
  birthYear: "CHILD_PRIVATE",
  avatarId: "CHILD_PRIVATE",
};

/**
 * `version` is the optimistic-concurrency token for this aggregate root
 * per docs/architecture/concurrency-and-conflicts.md ("Use optimistic
 * version checks for mutable aggregates and return an explicit conflict
 * when the submitted version is stale"). Family is the aggregate root for
 * its ParentMembership/ChildProfile children — a single version covers
 * the whole aggregate, not each child record separately.
 */
export const FamilySchema = z.object({
  familyId: FamilyId,
  status: z.enum(FAMILY_STATUSES),
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  parents: z.array(ParentMembershipSchema).min(1),
  children: z.array(ChildProfileSchema),
});
export type Family = z.infer<typeof FamilySchema>;

export const FAMILY_CLASSIFICATION: ClassificationMap<
  keyof Omit<Family, "parents" | "children">
> = {
  familyId: "FAMILY",
  status: "FAMILY",
  version: "FAMILY",
  createdAt: "FAMILY",
};

/**
 * Second-parent invitation token (P1-001). Carries the capability grant
 * that will be applied when the invitee accepts. The token is a one-time
 * secret; its `id` is used as the URL-safe bearer token in the invite
 * link. Expiry at 48 h is a product decision from family-lifecycle.md's
 * acceptance flow; it is enforced by the service, not this schema.
 */
export const INVITATION_STATUSES = ["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const InvitationTokenSchema = z.object({
  tokenId: InvitationTokenId,
  familyId: FamilyId,
  inviteeId: ParentId,
  capabilities: z.array(z.enum(PARENT_CAPABILITIES)),
  status: z.enum(INVITATION_STATUSES),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  acceptedAt: z.string().datetime().optional(),
});
export type InvitationToken = z.infer<typeof InvitationTokenSchema>;
