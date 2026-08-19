import type { PoolClient } from "pg";
import type { ParentCapability } from "@life/domain-types";
import { RepositoryAuthorizationError } from "./errors.js";

/**
 * Actor/family-membership authorization (P1-025).
 *
 * Closes DISC-P1-021-1 (packages/security-red-team findings RT-002,
 * RT-003, RT-005, RT-016): the pure domain layer intentionally does not
 * check that an actor is a real, ACTIVE parent member of the family it
 * is acting on -- family-service.ts does (via its own in-memory
 * requireCapability against a loaded Family), task-service.ts and
 * reward-service.ts do not, by disclosed design ("enforced by the
 * application layer, not here"). This module is that application layer.
 *
 * A child's id is never a row in `parent_memberships` -- querying that
 * table is what makes `requireActiveParentMember` also reject a child
 * attempting to act as a parent (RT-003's self-approval exploit),
 * without needing a separate "is this a child" check.
 */

/**
 * Verifies `actorId` is an ACTIVE parent member of `familyId`. Optionally
 * also requires ownership or a specific capability. Throws
 * RepositoryAuthorizationError otherwise -- never returns a boolean, so a
 * caller cannot forget to check the result.
 */
export async function requireActiveParentMember(
  client: PoolClient,
  familyId: string,
  actorId: string,
  opts: { requireOwner?: boolean; requireCapability?: ParentCapability } = {},
): Promise<void> {
  const { rows } = await client.query<{ is_family_owner: boolean; capabilities: string[]; status: string }>(
    "SELECT is_family_owner, capabilities, status FROM parent_memberships WHERE family_id = $1 AND parent_id = $2",
    [familyId, actorId],
  );
  const membership = rows[0];
  if (!membership || membership.status !== "ACTIVE") {
    throw new RepositoryAuthorizationError(
      "NOT_ACTIVE_FAMILY_MEMBER",
      `Actor ${actorId} is not an ACTIVE parent member of family ${familyId}`,
    );
  }
  if (opts.requireOwner && !membership.is_family_owner) {
    throw new RepositoryAuthorizationError(
      "NOT_FAMILY_OWNER",
      `Actor ${actorId} is not the owner of family ${familyId}`,
    );
  }
  if (
    opts.requireCapability &&
    !membership.is_family_owner &&
    !membership.capabilities.includes(opts.requireCapability)
  ) {
    throw new RepositoryAuthorizationError(
      "MISSING_CAPABILITY",
      `Actor ${actorId} lacks capability ${opts.requireCapability} in family ${familyId}`,
    );
  }
}

/**
 * Like `requireActiveParentMember`, but also accepts the literal
 * `"system"` actor (the automated Verification Engine) -- for
 * `verifyTask`'s automated verification strategies
 * (docs/product/actors-and-permissions.md: "approveTask / rejectTask: a
 * parent with base access OR the automated Verification Engine
 * (actorId === 'system')").
 */
export async function requireActiveParentMemberOrSystem(
  client: PoolClient,
  familyId: string,
  actorId: string,
): Promise<void> {
  if (actorId === "system") return;
  await requireActiveParentMember(client, familyId, actorId);
}

/**
 * Verifies `childId` is a real member of `familyId`. Closes RT-016
 * (assignTask accepting a child from a different family) -- the
 * function's own docstring already disclosed the gap.
 */
export async function requireChildInFamily(
  client: PoolClient,
  familyId: string,
  childId: string,
): Promise<void> {
  const { rows } = await client.query(
    "SELECT 1 FROM child_profiles WHERE family_id = $1 AND child_id = $2",
    [familyId, childId],
  );
  if (rows.length === 0) {
    throw new RepositoryAuthorizationError(
      "CHILD_NOT_IN_FAMILY",
      `Child ${childId} is not a member of family ${familyId}`,
    );
  }
}
