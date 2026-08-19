/**
 * Real-session test helper (P1-031).
 *
 * Before this task, e2e tests authenticated by calling `signSessionToken`
 * to mint their own JWT. That worked only because `SessionGuard` verified
 * a signature; it now resolves an opaque id against the `sessions` table
 * (ADR-0006 D2), so a self-minted token is correctly rejected.
 *
 * That is the point rather than an inconvenience: tests now obtain a
 * session the same way a real client does, so the auth path is exercised
 * by every suite that needs a logged-in caller instead of being bypassed.
 */
import { randomUUID } from "node:crypto";
import { withTransaction } from "../../src/db/pool.js";
import { familyRepository, identityRepository } from "../../src/repositories/index.js";

const PASSWORD = "test-password-1234";

export interface RealParent {
  accountId: string;
  parentId: string;
  familyId: string;
  email: string;
  password: string;
  /** Opaque bearer value -- a real session row, revocable like any other. */
  sessionId: string;
}

/**
 * Creates an account, a family owned by it, and a live parent session.
 * Everything goes through the same repositories production uses.
 */
export async function createRealParentSession(now = new Date().toISOString()): Promise<RealParent> {
  const email = `e2e-${randomUUID()}@example.test`;
  return withTransaction(async (client) => {
    const account = await identityRepository.registerAccount(client, { email, password: PASSWORD, now });
    const familyId = randomUUID();
    await familyRepository.createFamily(client, {
      familyId: familyId as never,
      ownerId: account.parentId as never,
      now,
    });
    const session = await identityRepository.issueParentSession(client, { account, familyId, now });
    return {
      accountId: account.accountId,
      parentId: account.parentId,
      familyId,
      email,
      password: PASSWORD,
      sessionId: session.sessionId,
    };
  });
}

/** Provisions a child session the way a parent would, for child-acting tests. */
export async function createRealChildSession(
  familyId: string,
  childId: string,
  issuedByParentId: string,
  now = new Date().toISOString(),
): Promise<string> {
  const session = await withTransaction((client) =>
    identityRepository.provisionChildSession(client, { familyId, childId, issuedByParentId, now }),
  );
  return session.sessionId;
}
