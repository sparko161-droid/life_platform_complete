/**
 * Session resolution by record lookup (P1-031).
 *
 * Replaces JWT verification as the guard's source of truth, per
 * docs/adr/0006-identity-and-session-model.md D2. Until now
 * `SessionGuard` verified a signed token, which meant P1-030's
 * revocation could not actually stop live traffic: a signature stays
 * valid until it expires, so a revoked parent kept working until their
 * token aged out. This is where that gap closes.
 *
 * The opaque bearer value is the `sessionId`. It maps to a row that can
 * be revoked; that is the whole point, and the cost -- one lookup per
 * authenticated request -- is the one ADR-0006 accepted knowingly.
 *
 * `system` is deliberately not resolvable here. The Verification Engine
 * is a service principal, not a user
 * (docs/product/actors-and-permissions.md), so it has no Session row and
 * must not be able to obtain one by presenting a bearer value.
 */
import type { PoolClient } from "pg";
import { identityRepository } from "../repositories/index.js";
import type { SessionClaims } from "./session.js";

/**
 * Resolves a bearer value to session claims, or `null` if it does not
 * correspond to a live session.
 *
 * Returns one undifferentiated `null` for unknown, expired and revoked.
 * A caller has no legitimate reason to tell them apart, and an
 * "expired vs revoked" signal would leak account state to whoever holds
 * a stale identifier.
 */
export async function resolveSession(
  client: PoolClient,
  bearerValue: string,
  now: string,
): Promise<SessionClaims | null> {
  // A malformed value is not an error worth distinguishing either --
  // findActiveSession would reject it anyway, but a uuid-shaped guard
  // avoids sending obvious junk to the database on every probe.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(bearerValue)) {
    return null;
  }

  const session = await identityRepository.findActiveSession(client, bearerValue, now);
  if (!session) return null;

  if (session.subjectKind === "PARENT") {
    // The schema guarantees these are present for a PARENT row, but the
    // guard should not depend on that being true of every future writer.
    if (!session.parentId) return null;
    return { actorId: session.parentId, role: "parent", familyId: session.familyId };
  }

  if (!session.childId) return null;
  return { actorId: session.childId, role: "child", familyId: session.familyId };
}
