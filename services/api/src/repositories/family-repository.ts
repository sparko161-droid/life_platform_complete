/**
 * Family repository (P1-025).
 *
 * family-service.ts's functions already take the full `Family` aggregate
 * and self-enforce authorization against its real `parents`/`children`
 * (requireActiveMember/requireCapability/requireOwner) -- unlike
 * task-service.ts/reward-service.ts, this repository does not need
 * services/api/src/repositories/auth.ts at all. Its job is purely
 * load-aggregate / call domain function / persist-aggregate under
 * optimistic-version enforcement.
 */
import type { PoolClient } from "pg";
import {
  type AcceptInvitationCommand,
  type AddChildCommand,
  type CreateFamilyCommand,
  type Family,
  type InvitationToken,
  type InviteParentCommand,
  type RevokeParentCommand,
  acceptInvitation as acceptInvitationDomain,
  addChild as addChildDomain,
  createFamily as createFamilyDomain,
  inviteParent as inviteParentDomain,
  revokeParent as revokeParentDomain,
} from "@life/domain-types";
import { rowToChildProfile, rowToFamily, rowToParentMembership } from "../db/rows.js";
import { RepositoryConflictError, RepositoryNotFoundError } from "./errors.js";

async function loadFamily(client: PoolClient, familyId: string): Promise<Family | null> {
  const familyResult = await client.query(
    "SELECT family_id, status, version, created_at FROM families WHERE family_id = $1 FOR UPDATE",
    [familyId],
  );
  const familyRow = familyResult.rows[0];
  if (!familyRow) return null;

  const [parentsResult, childrenResult] = await Promise.all([
    client.query(
      "SELECT family_id, parent_id, status, is_family_owner, capabilities, invited_at, activated_at, revoked_at FROM parent_memberships WHERE family_id = $1",
      [familyId],
    ),
    client.query(
      "SELECT child_id, family_id, display_name, birth_year, avatar_id FROM child_profiles WHERE family_id = $1",
      [familyId],
    ),
  ]);

  return rowToFamily(familyRow, parentsResult.rows, childrenResult.rows);
}

/**
 * Persists every field of `next` (family row, and a full upsert of every
 * parent/child membership row) under an optimistic-version guard: fails
 * with RepositoryConflictError if `expectedVersion` no longer matches --
 * defense in depth alongside the `SELECT ... FOR UPDATE` row lock
 * `loadFamily` already took in the same transaction.
 */
async function saveFamily(client: PoolClient, next: Family, expectedVersion: number): Promise<void> {
  const updateResult = await client.query(
    "UPDATE families SET status = $1, version = $2 WHERE family_id = $3 AND version = $4",
    [next.status, next.version, next.familyId, expectedVersion],
  );
  if (updateResult.rowCount === 0) {
    throw new RepositoryConflictError("Family", next.familyId);
  }

  for (const p of next.parents) {
    await client.query(
      `INSERT INTO parent_memberships (family_id, parent_id, status, is_family_owner, capabilities, invited_at, activated_at, revoked_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (family_id, parent_id) DO UPDATE SET
         status = EXCLUDED.status,
         is_family_owner = EXCLUDED.is_family_owner,
         capabilities = EXCLUDED.capabilities,
         activated_at = EXCLUDED.activated_at,
         revoked_at = EXCLUDED.revoked_at`,
      [next.familyId, p.parentId, p.status, p.isFamilyOwner, p.capabilities, p.invitedAt, p.activatedAt ?? null, p.revokedAt ?? null],
    );
  }

  for (const c of next.children) {
    await client.query(
      `INSERT INTO child_profiles (child_id, family_id, display_name, birth_year, avatar_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (child_id) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         birth_year = EXCLUDED.birth_year,
         avatar_id = EXCLUDED.avatar_id`,
      [c.childId, next.familyId, c.displayName, c.birthYear, c.avatarId ?? null],
    );
  }
}

export async function createFamily(client: PoolClient, command: CreateFamilyCommand): Promise<Family> {
  const { next } = createFamilyDomain(command);
  await client.query("INSERT INTO families (family_id, status, version, created_at) VALUES ($1, $2, $3, $4)", [
    next.familyId,
    next.status,
    next.version,
    next.createdAt,
  ]);
  const owner = next.parents[0]!;
  await client.query(
    `INSERT INTO parent_memberships (family_id, parent_id, status, is_family_owner, capabilities, invited_at, activated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [next.familyId, owner.parentId, owner.status, owner.isFamilyOwner, owner.capabilities, owner.invitedAt, owner.activatedAt ?? null],
  );
  return next;
}

export async function addChild(client: PoolClient, familyId: string, command: AddChildCommand): Promise<Family> {
  const family = await loadFamily(client, familyId);
  if (!family) throw new RepositoryNotFoundError("Family", familyId);
  const { next } = addChildDomain(family, command);
  await saveFamily(client, next, family.version);
  return next;
}

export async function inviteParent(
  client: PoolClient,
  familyId: string,
  command: InviteParentCommand,
): Promise<{ family: Family; token: InvitationToken }> {
  const family = await loadFamily(client, familyId);
  if (!family) throw new RepositoryNotFoundError("Family", familyId);
  const { next } = inviteParentDomain(family, command);
  await saveFamily(client, next.family, family.version);
  await client.query(
    `INSERT INTO invitation_tokens (token_id, family_id, invitee_id, capabilities, status, created_at, expires_at, accepted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      next.token.tokenId,
      next.token.familyId,
      next.token.inviteeId,
      next.token.capabilities,
      next.token.status,
      next.token.createdAt,
      next.token.expiresAt,
      next.token.acceptedAt ?? null,
    ],
  );
  return next;
}

async function loadInvitationToken(client: PoolClient, tokenId: string): Promise<InvitationToken | null> {
  const { rows } = await client.query(
    "SELECT token_id, family_id, invitee_id, capabilities, status, created_at, expires_at, accepted_at FROM invitation_tokens WHERE token_id = $1 FOR UPDATE",
    [tokenId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    tokenId: row.token_id,
    familyId: row.family_id,
    inviteeId: row.invitee_id,
    capabilities: row.capabilities,
    status: row.status,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    expiresAt: row.expires_at instanceof Date ? row.expires_at.toISOString() : row.expires_at,
    ...(row.accepted_at
      ? { acceptedAt: row.accepted_at instanceof Date ? row.accepted_at.toISOString() : row.accepted_at }
      : {}),
  };
}

export async function acceptInvitation(
  client: PoolClient,
  familyId: string,
  tokenId: string,
  command: AcceptInvitationCommand,
): Promise<{ family: Family; token: InvitationToken }> {
  const family = await loadFamily(client, familyId);
  if (!family) throw new RepositoryNotFoundError("Family", familyId);
  const token = await loadInvitationToken(client, tokenId);
  if (!token) throw new RepositoryNotFoundError("InvitationToken", tokenId);

  const { next } = acceptInvitationDomain(family, token, command);
  await saveFamily(client, next.family, family.version);
  await client.query("UPDATE invitation_tokens SET status = $1, accepted_at = $2 WHERE token_id = $3", [
    next.token.status,
    next.token.acceptedAt ?? null,
    tokenId,
  ]);
  return next;
}

export async function revokeParent(
  client: PoolClient,
  familyId: string,
  command: RevokeParentCommand,
): Promise<Family> {
  const family = await loadFamily(client, familyId);
  if (!family) throw new RepositoryNotFoundError("Family", familyId);
  const { next } = revokeParentDomain(family, command);
  await saveFamily(client, next, family.version);
  return next;
}

export { loadFamily };
