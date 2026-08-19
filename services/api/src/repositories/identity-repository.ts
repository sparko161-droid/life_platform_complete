/**
 * Identity repository (P1-030) -- accounts, credentials and server-side
 * sessions, per docs/adr/0006-identity-and-session-model.md.
 *
 * The security-relevant properties are enforced here and in the schema,
 * not left to callers:
 *
 *  - `verifyPassword` runs the hash comparison even when the account does
 *    not exist, so a caller cannot tell "no such user" from "wrong
 *    password" by timing.
 *  - A CHILD session cannot be created without a provisioning parent, and
 *    that parent is checked to be a real ACTIVE member of the family --
 *    a child session is never self-service.
 *  - `revokeSessionsForParent` is what finally discharges
 *    docs/product/family-lifecycle.md's promise that "Revocation
 *    immediately invalidates protected access tokens/session grants".
 */
import { randomUUID } from "node:crypto";
import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";
import type { PoolClient } from "pg";
import {
  type Account,
  type AccountId,
  type ChildId,
  type FamilyId,
  type ParentId,
  type Session,
  type SessionId,
  isSessionActive,
} from "@life/domain-types";
import { requireActiveParentMember, requireChildInFamily } from "./auth.js";
import { RepositoryAuthorizationError, RepositoryConflictError, RepositoryNotFoundError } from "./errors.js";

const iso = (d: Date | string): string => (d instanceof Date ? d.toISOString() : d);

/** Default session lifetime. Matches @life/web-session's cookie maxAge. */
export const DEFAULT_SESSION_TTL_SECONDS = 3600;

/**
 * A throwaway hash compared against when no account matches, so the
 * failure path costs roughly the same as the success path. Computed once
 * at module load rather than per call.
 */
const DUMMY_HASH_PROMISE = argonHash("no-such-account-timing-equaliser");

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

interface AccountRow {
  account_id: string;
  parent_id: string;
  email: string;
  auth_provider: string;
  status: string;
  consent_accepted_at: Date | string | null;
  version: number;
  created_at: Date | string;
}

function rowToAccount(row: AccountRow): Account {
  return {
    accountId: row.account_id as AccountId,
    parentId: row.parent_id as ParentId,
    email: row.email,
    authProvider: row.auth_provider as Account["authProvider"],
    status: row.status as Account["status"],
    ...(row.consent_accepted_at ? { consentAcceptedAt: iso(row.consent_accepted_at) } : {}),
    version: row.version,
    createdAt: iso(row.created_at),
  };
}

interface SessionRow {
  session_id: string;
  subject_kind: string;
  account_id: string | null;
  parent_id: string | null;
  child_id: string | null;
  family_id: string;
  issued_by_parent_id: string | null;
  issued_at: Date | string;
  expires_at: Date | string;
  revoked_at: Date | string | null;
}

function rowToSession(row: SessionRow): Session {
  return {
    sessionId: row.session_id as SessionId,
    subjectKind: row.subject_kind as Session["subjectKind"],
    ...(row.account_id ? { accountId: row.account_id as AccountId } : {}),
    ...(row.parent_id ? { parentId: row.parent_id as ParentId } : {}),
    ...(row.child_id ? { childId: row.child_id as ChildId } : {}),
    familyId: row.family_id as FamilyId,
    ...(row.issued_by_parent_id ? { issuedByParentId: row.issued_by_parent_id as ParentId } : {}),
    issuedAt: iso(row.issued_at),
    expiresAt: iso(row.expires_at),
    ...(row.revoked_at ? { revokedAt: iso(row.revoked_at) } : {}),
  };
}

// ---------------------------------------------------------------------------
// Accounts and credentials
// ---------------------------------------------------------------------------

export interface RegisterAccountCommand {
  email: string;
  password: string;
  now: string;
  /** Optional so tests and fixtures can pin ids; generated otherwise. */
  accountId?: string;
  parentId?: string;
}

/**
 * Creates an account plus its credential. The password is hashed before
 * anything is written, so a failure in hashing cannot leave an account
 * with no credential.
 */
export async function registerAccount(client: PoolClient, command: RegisterAccountCommand): Promise<Account> {
  const passwordHash = await argonHash(command.password);
  const accountId = (command.accountId ?? randomUUID()) as AccountId;
  const parentId = (command.parentId ?? randomUUID()) as ParentId;

  const inserted = await client.query<AccountRow>(
    `INSERT INTO accounts (account_id, parent_id, email, auth_provider, status, version, created_at)
     VALUES ($1, $2, $3, 'PASSWORD', 'PENDING_VERIFICATION', 1, $4)
     ON CONFLICT DO NOTHING
     RETURNING account_id, parent_id, email, auth_provider, status, consent_accepted_at, version, created_at`,
    [accountId, parentId, command.email, command.now],
  );
  const row = inserted.rows[0];
  if (!row) {
    // The unique index on LOWER(email) did its job. Deliberately not
    // reported as "email already registered" -- that is an account
    // enumeration oracle. The caller maps this to a generic failure.
    throw new RepositoryConflictError("Account", command.email);
  }

  await client.query(
    `INSERT INTO credentials (account_id, algorithm, password_hash, updated_at) VALUES ($1, 'ARGON2ID', $2, $3)`,
    [accountId, passwordHash, command.now],
  );
  return rowToAccount(row);
}

export async function findAccountByEmail(client: PoolClient, email: string): Promise<Account | null> {
  const { rows } = await client.query<AccountRow>(
    `SELECT account_id, parent_id, email, auth_provider, status, consent_accepted_at, version, created_at
     FROM accounts WHERE LOWER(email) = LOWER($1)`,
    [email],
  );
  return rows[0] ? rowToAccount(rows[0]) : null;
}

/**
 * Verifies a password against an account.
 *
 * Returns the account on success and `null` on any failure -- wrong
 * password, unknown email, or an account not in a usable state. One
 * undifferentiated result on purpose: distinguishing them tells an
 * attacker which emails are registered.
 *
 * The dummy-hash comparison on the miss path keeps the timing of "no such
 * account" close to "wrong password".
 */
export async function verifyPassword(client: PoolClient, email: string, password: string): Promise<Account | null> {
  const { rows } = await client.query<AccountRow & { password_hash: string | null }>(
    `SELECT a.account_id, a.parent_id, a.email, a.auth_provider, a.status, a.consent_accepted_at, a.version, a.created_at,
            c.password_hash
     FROM accounts a LEFT JOIN credentials c ON c.account_id = a.account_id
     WHERE LOWER(a.email) = LOWER($1)`,
    [email],
  );
  const row = rows[0];
  if (!row?.password_hash) {
    await argonVerify(await DUMMY_HASH_PROMISE, password).catch(() => false);
    return null;
  }
  const ok = await argonVerify(row.password_hash, password).catch(() => false);
  if (!ok) return null;
  // A SUSPENDED or CLOSED account authenticates correctly but must not
  // get a session. Checked after the hash so the timing does not differ.
  if (row.status !== "ACTIVE" && row.status !== "PENDING_VERIFICATION") return null;
  return rowToAccount(row);
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

function expiryFrom(now: string, ttlSeconds: number): string {
  return new Date(new Date(now).getTime() + ttlSeconds * 1000).toISOString();
}

export interface IssueParentSessionCommand {
  account: Account;
  /**
   * Omit to issue a *bootstrap* session: a parent who has authenticated
   * but belongs to no family yet, and may only create one. Required
   * otherwise, and checked -- authenticating proves who you are, not
   * what you may act on.
   */
  familyId?: string;
  now: string;
  ttlSeconds?: number;
}

export async function issueParentSession(client: PoolClient, command: IssueParentSessionCommand): Promise<Session> {
  if (command.familyId) {
    await requireActiveParentMember(client, command.familyId, command.account.parentId);
  }

  const sessionId = randomUUID();
  const expiresAt = expiryFrom(command.now, command.ttlSeconds ?? DEFAULT_SESSION_TTL_SECONDS);
  const { rows } = await client.query<SessionRow>(
    `INSERT INTO sessions (session_id, subject_kind, account_id, parent_id, family_id, issued_at, expires_at)
     VALUES ($1, 'PARENT', $2, $3, $4, $5, $6)
     RETURNING session_id, subject_kind, account_id, parent_id, child_id, family_id, issued_by_parent_id, issued_at, expires_at, revoked_at`,
    [sessionId, command.account.accountId, command.account.parentId, command.familyId ?? null, command.now, expiresAt],
  );
  return rowToSession(rows[0]!);
}

export interface ProvisionChildSessionCommand {
  familyId: string;
  childId: string;
  /** The authenticated parent doing the provisioning. */
  issuedByParentId: string;
  now: string;
  ttlSeconds?: number;
}

/**
 * Issues a session for a child device. Always parent-provisioned
 * (ADR-0006 D3) -- there is no path that mints one from a child-supplied
 * credential, because no such credential exists.
 */
export async function provisionChildSession(client: PoolClient, command: ProvisionChildSessionCommand): Promise<Session> {
  await requireActiveParentMember(client, command.familyId, command.issuedByParentId);
  // Closes the same class of gap RT-016 found in assignTask: a parent of
  // family A must not be able to provision a session for family B's child.
  await requireChildInFamily(client, command.familyId, command.childId);

  const sessionId = randomUUID();
  const expiresAt = expiryFrom(command.now, command.ttlSeconds ?? DEFAULT_SESSION_TTL_SECONDS);
  const { rows } = await client.query<SessionRow>(
    `INSERT INTO sessions (session_id, subject_kind, child_id, family_id, issued_by_parent_id, issued_at, expires_at)
     VALUES ($1, 'CHILD', $2, $3, $4, $5, $6)
     RETURNING session_id, subject_kind, account_id, parent_id, child_id, family_id, issued_by_parent_id, issued_at, expires_at, revoked_at`,
    [sessionId, command.childId, command.familyId, command.issuedByParentId, command.now, expiresAt],
  );
  return rowToSession(rows[0]!);
}

/**
 * Loads a session and returns it only if it is usable at `now`.
 * Returns `null` for missing, expired or revoked -- the caller has no
 * reason to distinguish, and an "expired" vs "revoked" signal leaks
 * account state to whoever holds a stale id.
 */
export async function findActiveSession(client: PoolClient, sessionId: string, now: string): Promise<Session | null> {
  const { rows } = await client.query<SessionRow>(
    `SELECT session_id, subject_kind, account_id, parent_id, child_id, family_id, issued_by_parent_id, issued_at, expires_at, revoked_at
     FROM sessions WHERE session_id = $1`,
    [sessionId],
  );
  const row = rows[0];
  if (!row) return null;
  const session = rowToSession(row);
  return isSessionActive(session, now) ? session : null;
}

export async function revokeSession(client: PoolClient, sessionId: string, now: string): Promise<void> {
  const result = await client.query("UPDATE sessions SET revoked_at = $1 WHERE session_id = $2 AND revoked_at IS NULL", [
    now,
    sessionId,
  ]);
  if (result.rowCount === 0) {
    // Already revoked, or never existed. Idempotent by design: a
    // sign-out that runs twice is not an error.
    const exists = await client.query("SELECT 1 FROM sessions WHERE session_id = $1", [sessionId]);
    if (exists.rowCount === 0) throw new RepositoryNotFoundError("Session", sessionId);
  }
}

/**
 * Revokes every live session belonging to a parent.
 *
 * This is the function that discharges docs/product/family-lifecycle.md's
 * "Revocation immediately invalidates protected access tokens/session
 * grants" -- and the reason ADR-0006 chose session records over
 * self-contained signed tokens, which cannot be withdrawn once issued.
 *
 * Returns the number of sessions cut, so a caller can log or assert it
 * rather than assume.
 */
export async function revokeSessionsForParent(client: PoolClient, parentId: string, now: string): Promise<number> {
  const result = await client.query(
    "UPDATE sessions SET revoked_at = $1 WHERE parent_id = $2 AND revoked_at IS NULL",
    [now, parentId],
  );
  return result.rowCount ?? 0;
}

/**
 * Revokes every live session a parent provisioned for a child -- used
 * when a child's access is withdrawn without removing the parent.
 */
export async function revokeSessionsForChild(client: PoolClient, childId: string, now: string): Promise<number> {
  const result = await client.query("UPDATE sessions SET revoked_at = $1 WHERE child_id = $2 AND revoked_at IS NULL", [
    now,
    childId,
  ]);
  return result.rowCount ?? 0;
}

/** Marks an account's consent as accepted and moves it out of PENDING_VERIFICATION. */
export async function acceptConsent(client: PoolClient, accountId: string, now: string): Promise<Account> {
  const { rows } = await client.query<AccountRow>(
    `UPDATE accounts
     SET consent_accepted_at = $1, status = 'ACTIVE', version = version + 1
     WHERE account_id = $2 AND status = 'PENDING_VERIFICATION'
     RETURNING account_id, parent_id, email, auth_provider, status, consent_accepted_at, version, created_at`,
    [now, accountId],
  );
  const row = rows[0];
  if (!row) {
    const exists = await client.query("SELECT 1 FROM accounts WHERE account_id = $1", [accountId]);
    if (exists.rowCount === 0) throw new RepositoryNotFoundError("Account", accountId);
    throw new RepositoryAuthorizationError("CONSENT_NOT_PENDING", "Account is not awaiting consent");
  }
  return rowToAccount(row);
}
