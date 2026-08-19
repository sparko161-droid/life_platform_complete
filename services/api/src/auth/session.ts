/**
 * Session token issuance/verification (P1-026).
 *
 * openapi.yaml already commits to `BearerAuth` (JWT) as this API's
 * security scheme -- this module implements that, not a new choice.
 * Scope, per tasks/packets/BLK-P1-006-007-persistence-api-pack.md: "a
 * request is provably bound to one real actor," not full auth (password
 * reset, OAuth, MFA are explicitly out of scope). A claims payload of
 * `{actorId, familyId, role}` is exactly what
 * services/api/src/repositories/auth.ts's requireActiveParentMember(OrSystem)
 * needs to check -- and, just as importantly, this is what the P1-021 red
 * team assessment's whole point was: actorId must come from a verified
 * token, never a client-supplied request-body field.
 */
import jwt from "jsonwebtoken";

/** @public */
export type SessionRole = "parent" | "child" | "system";

/** @public */
export interface SessionClaims {
  actorId: string;
  role: SessionRole;
  /** Absent only for `role: "system"` (the automated Verification Engine has no single family). */
  familyId?: string;
}

export class InvalidSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSessionError";
  }
}

function getSecret(): string {
  const secret = process.env.SESSION_JWT_SECRET;
  if (!secret) {
    throw new Error("SESSION_JWT_SECRET is not set (see .env.example)");
  }
  return secret;
}

/**
 * Signs a session token. Only used by test fixtures and whatever future
 * login endpoint issues real sessions -- request handlers only ever
 * verify, never sign.
 * @public
 */
export function signSessionToken(claims: SessionClaims, expiresInSeconds = 3600): string {
  return jwt.sign(claims, getSecret(), { expiresIn: expiresInSeconds });
}

/** @public */
export function verifySessionToken(token: string): SessionClaims {
  try {
    const decoded = jwt.verify(token, getSecret());
    if (typeof decoded !== "object" || decoded === null || typeof decoded.actorId !== "string" || typeof decoded.role !== "string") {
      throw new InvalidSessionError("Token payload is missing actorId/role");
    }
    const claims: SessionClaims = {
      actorId: decoded.actorId,
      role: decoded.role as SessionRole,
      ...(typeof decoded.familyId === "string" ? { familyId: decoded.familyId } : {}),
    };
    return claims;
  } catch (err) {
    if (err instanceof InvalidSessionError) throw err;
    throw new InvalidSessionError(err instanceof Error ? err.message : "Invalid session token");
  }
}
