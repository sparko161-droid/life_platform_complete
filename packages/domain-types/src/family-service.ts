import { randomUUID } from "node:crypto";
import type { EventEnvelope } from "./events.js";
import {
  type ChildProfile,
  type Family,
  type FamilyStatus,
  type InvitationToken,
  type ParentCapability,
  type ParentMembership,
  isValidFamilyTransition,
} from "./family.js";
import type { ChildId, FamilyId, InvitationTokenId, ParentId } from "./ids.js";

/**
 * Family lifecycle domain service (P1-001).
 *
 * Implements "Family lifecycle and second-parent invitation"
 * (tasks/registry.yaml) as a pure domain layer: every function takes
 * current aggregate state and a command, returns the next state and the
 * events to be persisted. No I/O occurs here.
 *
 * Authorization model:
 *   - `createFamily`: any authenticated parent (bootstraps the family)
 *   - `addChild`: family member with CHILD_POLICY capability or owner
 *   - `inviteParent`: family owner only
 *   - `acceptInvitation`: the invitee named in the token only
 *   - `revokeParent`: family owner only; cannot self-revoke
 *
 * Concurrency: callers MUST pass the version they read; the returned
 * family has version+1. A write-conflict (stale version) is the caller's
 * responsibility — the domain layer does not know about the persistence
 * layer's version check.
 *
 * Sources:
 *   - docs/product/family-lifecycle.md
 *   - docs/product/actors-and-permissions.md
 *   - docs/architecture/concurrency-and-conflicts.md
 */

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class FamilyDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "FamilyDomainError";
  }
}

// ---------------------------------------------------------------------------
// Command types
// ---------------------------------------------------------------------------

export interface CreateFamilyCommand {
  familyId: FamilyId;
  ownerId: ParentId;
  /** ISO-8601 string; injected for testability. */
  now: string;
}

export interface AddChildCommand {
  childId: ChildId;
  displayName: string;
  birthYear: number;
  avatarId?: string;
  actorId: ParentId;
  /** ISO-8601 string; injected for testability. */
  now: string;
}

export interface InviteParentCommand {
  tokenId: InvitationTokenId;
  inviteeId: ParentId;
  capabilities: ParentCapability[];
  actorId: ParentId;
  /** ISO-8601 string; injected for testability. */
  now: string;
  /** Invitation expiry, ISO-8601; defaults to 48 h after `now`. */
  expiresAt?: string;
}

export interface AcceptInvitationCommand {
  actorId: ParentId;
  /** ISO-8601 string; injected for testability. */
  now: string;
}

export interface RevokeParentCommand {
  targetId: ParentId;
  actorId: ParentId;
  /** ISO-8601 string; injected for testability. */
  now: string;
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface FamilyCommandResult<T> {
  next: T;
  events: EventEnvelope[];
}

// ---------------------------------------------------------------------------
// Authorization helpers
// ---------------------------------------------------------------------------

function requireActiveMember(family: Family, actorId: ParentId, code: string): ParentMembership {
  const membership = family.parents.find((p) => p.parentId === actorId);
  if (!membership) {
    throw new FamilyDomainError(code, `Actor ${actorId} is not a member of family ${family.familyId}`);
  }
  if (membership.status !== "ACTIVE") {
    throw new FamilyDomainError(code, `Actor ${actorId} has status ${membership.status}, not ACTIVE`);
  }
  return membership;
}

function requireCapability(membership: ParentMembership, capability: ParentCapability, code: string): void {
  if (!membership.isFamilyOwner && !membership.capabilities.includes(capability)) {
    throw new FamilyDomainError(
      code,
      `Actor ${membership.parentId} lacks capability ${capability} (not owner, capabilities=[${membership.capabilities.join(",")}])`,
    );
  }
}

function requireOwner(membership: ParentMembership, code: string): void {
  if (!membership.isFamilyOwner) {
    throw new FamilyDomainError(code, `Actor ${membership.parentId} is not the family owner`);
  }
}

function requireFamilyActive(family: Family, code: string): void {
  if (family.status !== "ACTIVE") {
    throw new FamilyDomainError(code, `Family ${family.familyId} is ${family.status}, not ACTIVE`);
  }
}

// ---------------------------------------------------------------------------
// Event envelope factory
// ---------------------------------------------------------------------------

function makeEvent(
  eventType: string,
  familyId: FamilyId,
  actorId: ParentId,
  aggregateId: string,
  version: number,
  now: string,
  payload: Record<string, unknown>,
  childId?: ChildId,
): EventEnvelope {
  return {
    eventId: randomUUID() as string,
    eventType,
    occurredAt: now,
    actorId,
    familyId,
    aggregateId,
    version,
    payload,
    ...(childId !== undefined ? { childId } : {}),
  };
}

// ---------------------------------------------------------------------------
// Domain service functions
// ---------------------------------------------------------------------------

/**
 * Bootstrap a new family. The creator becomes the family owner with all
 * capabilities granted by virtue of ownership. Status starts as ACTIVE
 * (the family is immediately usable; PENDING_INVITE is the state when a
 * second parent is still required before the family is considered ready,
 * which is a product decision not yet made -- defaulting to ACTIVE).
 */
export function createFamily(command: CreateFamilyCommand): FamilyCommandResult<Family> {
  const ownerMembership: ParentMembership = {
    parentId: command.ownerId,
    familyId: command.familyId,
    status: "ACTIVE",
    isFamilyOwner: true,
    capabilities: ["CHILD_POLICY", "MONEY_REWARDS", "SOCIAL_PERMISSIONS", "CHAT_VISIBILITY", "ACCOUNT_DELETION"],
    invitedAt: command.now,
    activatedAt: command.now,
  };

  const family: Family = {
    familyId: command.familyId,
    status: "ACTIVE",
    version: 1,
    createdAt: command.now,
    parents: [ownerMembership],
    children: [],
  };

  const event = makeEvent("FAMILY_CREATED", command.familyId, command.ownerId, command.familyId, 1, command.now, {
    ownerId: command.ownerId,
  });

  return { next: family, events: [event] };
}

/**
 * Add a child profile to the family. Requires CHILD_POLICY capability or
 * family ownership. A child belongs to exactly one active family.
 */
export function addChild(family: Family, command: AddChildCommand): FamilyCommandResult<Family> {
  requireFamilyActive(family, "ADD_CHILD_FAMILY_NOT_ACTIVE");
  const membership = requireActiveMember(family, command.actorId, "ADD_CHILD_UNAUTHORIZED");
  requireCapability(membership, "CHILD_POLICY", "ADD_CHILD_MISSING_CAPABILITY");

  const duplicate = family.children.find((c) => c.childId === command.childId);
  if (duplicate) {
    throw new FamilyDomainError("ADD_CHILD_DUPLICATE", `Child ${command.childId} already belongs to this family`);
  }

  const child: ChildProfile = {
    childId: command.childId,
    familyId: family.familyId,
    displayName: command.displayName,
    birthYear: command.birthYear,
    ...(command.avatarId !== undefined ? { avatarId: command.avatarId } : {}),
  };

  const nextVersion = family.version + 1;
  const nextFamily: Family = {
    ...family,
    version: nextVersion,
    children: [...family.children, child],
  };

  const event = makeEvent(
    "CHILD_ADDED",
    family.familyId,
    command.actorId,
    family.familyId,
    nextVersion,
    command.now,
    { childId: command.childId, displayName: command.displayName },
    command.childId,
  );

  return { next: nextFamily, events: [event] };
}

/**
 * Invite a second parent. Only the family owner may issue invitations.
 * Returns the updated family (no structural change yet) and an invitation
 * token the caller must persist and share with the invitee.
 */
export function inviteParent(
  family: Family,
  command: InviteParentCommand,
): FamilyCommandResult<{ family: Family; token: InvitationToken }> {
  requireFamilyActive(family, "INVITE_PARENT_FAMILY_NOT_ACTIVE");
  const membership = requireActiveMember(family, command.actorId, "INVITE_PARENT_UNAUTHORIZED");
  requireOwner(membership, "INVITE_PARENT_NOT_OWNER");

  const alreadyMember = family.parents.find((p) => p.parentId === command.inviteeId);
  if (alreadyMember && alreadyMember.status === "ACTIVE") {
    throw new FamilyDomainError("INVITE_PARENT_ALREADY_MEMBER", `Parent ${command.inviteeId} is already an ACTIVE member`);
  }

  // Default expiry: 48 hours
  const expiresAt =
    command.expiresAt ??
    new Date(new Date(command.now).getTime() + 48 * 60 * 60 * 1000).toISOString();

  const token: InvitationToken = {
    tokenId: command.tokenId,
    familyId: family.familyId,
    inviteeId: command.inviteeId,
    capabilities: command.capabilities,
    status: "PENDING",
    createdAt: command.now,
    expiresAt,
  };

  const nextVersion = family.version + 1;
  const nextFamily: Family = { ...family, version: nextVersion };

  const event = makeEvent(
    "PARENT_INVITED",
    family.familyId,
    command.actorId,
    family.familyId,
    nextVersion,
    command.now,
    {
      inviteeId: command.inviteeId,
      tokenId: command.tokenId,
      capabilities: command.capabilities,
      expiresAt,
    },
  );

  return { next: { family: nextFamily, token }, events: [event] };
}

/**
 * Accept an invitation. Only the invitee named in the token may accept.
 * Validates: token is PENDING, not expired, invitee matches actor.
 * Adds the invitee as an ACTIVE member with the capabilities in the token.
 */
export function acceptInvitation(
  family: Family,
  token: InvitationToken,
  command: AcceptInvitationCommand,
): FamilyCommandResult<{ family: Family; token: InvitationToken }> {
  requireFamilyActive(family, "ACCEPT_INVITATION_FAMILY_NOT_ACTIVE");

  if (token.familyId !== family.familyId) {
    throw new FamilyDomainError("ACCEPT_INVITATION_WRONG_FAMILY", "Token does not belong to this family");
  }
  if (token.inviteeId !== command.actorId) {
    throw new FamilyDomainError("ACCEPT_INVITATION_WRONG_ACTOR", "Only the named invitee may accept this invitation");
  }
  if (token.status !== "PENDING") {
    throw new FamilyDomainError("ACCEPT_INVITATION_NOT_PENDING", `Token status is ${token.status}, not PENDING`);
  }
  if (new Date(command.now) > new Date(token.expiresAt)) {
    throw new FamilyDomainError("ACCEPT_INVITATION_EXPIRED", `Invitation expired at ${token.expiresAt}`);
  }

  const newMembership: ParentMembership = {
    parentId: command.actorId,
    familyId: family.familyId,
    status: "ACTIVE",
    isFamilyOwner: false,
    capabilities: token.capabilities,
    invitedAt: token.createdAt,
    activatedAt: command.now,
  };

  const nextVersion = family.version + 1;
  const nextFamily: Family = {
    ...family,
    version: nextVersion,
    parents: [...family.parents.filter((p) => p.parentId !== command.actorId), newMembership],
  };

  const nextToken: InvitationToken = { ...token, status: "ACCEPTED", acceptedAt: command.now };

  const event = makeEvent(
    "PARENT_INVITATION_ACCEPTED",
    family.familyId,
    command.actorId,
    family.familyId,
    nextVersion,
    command.now,
    { inviteeId: command.actorId, tokenId: token.tokenId },
  );

  return { next: { family: nextFamily, token: nextToken }, events: [event] };
}

/**
 * Revoke a parent's membership. Only the family owner may revoke.
 * The owner cannot revoke themselves. Revocation immediately sets
 * membership status to REVOKED; downstream effects (session invalidation)
 * are handled by the event consumer.
 */
export function revokeParent(family: Family, command: RevokeParentCommand): FamilyCommandResult<Family> {
  requireFamilyActive(family, "REVOKE_PARENT_FAMILY_NOT_ACTIVE");
  const actor = requireActiveMember(family, command.actorId, "REVOKE_PARENT_UNAUTHORIZED");
  requireOwner(actor, "REVOKE_PARENT_NOT_OWNER");

  if (command.targetId === command.actorId) {
    throw new FamilyDomainError("REVOKE_PARENT_SELF_REVOKE", "The family owner cannot revoke themselves");
  }

  const target = family.parents.find((p) => p.parentId === command.targetId);
  if (!target || target.status !== "ACTIVE") {
    throw new FamilyDomainError("REVOKE_PARENT_NOT_MEMBER", `Parent ${command.targetId} is not an ACTIVE member`);
  }

  const nextVersion = family.version + 1;
  const nextFamily: Family = {
    ...family,
    version: nextVersion,
    parents: family.parents.map((p) =>
      p.parentId === command.targetId ? { ...p, status: "REVOKED", revokedAt: command.now } : p,
    ),
  };

  const event = makeEvent(
    "PARENT_MEMBERSHIP_REVOKED",
    family.familyId,
    command.actorId,
    family.familyId,
    nextVersion,
    command.now,
    { targetId: command.targetId },
  );

  return { next: nextFamily, events: [event] };
}

/**
 * Transition a family's own status (suspend / archive / reactivate).
 * Only the owner may change family status.
 *
 * Note: emits FAMILY_CREATED as a placeholder event type. A dedicated
 * FAMILY_STATUS_CHANGED event type should be added when a downstream
 * consumer needs to react to it -- not done here to avoid premature
 * event-schema expansion (docs/architecture/events.md: "add events when
 * a consumer exists, not speculatively").
 */
export function transitionFamilyStatus(
  family: Family,
  toStatus: FamilyStatus,
  actorId: ParentId,
  now: string,
): FamilyCommandResult<Family> {
  const actor = requireActiveMember(family, actorId, "TRANSITION_FAMILY_UNAUTHORIZED");
  requireOwner(actor, "TRANSITION_FAMILY_NOT_OWNER");

  if (!isValidFamilyTransition(family.status, toStatus)) {
    throw new FamilyDomainError(
      "TRANSITION_FAMILY_INVALID",
      `Cannot transition family from ${family.status} to ${toStatus}`,
    );
  }

  const nextVersion = family.version + 1;
  const nextFamily: Family = { ...family, version: nextVersion, status: toStatus };

  const event = makeEvent("FAMILY_CREATED", family.familyId, actorId, family.familyId, nextVersion, now, {
    transition: { from: family.status, to: toStatus },
  });

  return { next: nextFamily, events: [event] };
}
