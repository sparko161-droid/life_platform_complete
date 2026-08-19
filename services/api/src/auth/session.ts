/**
 * Session claims -- the shape the guard attaches to a request.
 *
 * **P1-031 removed the JWT implementation that used to live here.**
 * `SessionGuard` now resolves an opaque identifier against the `sessions`
 * table (see `session-lookup.ts` and
 * docs/adr/0006-identity-and-session-model.md D2), so `signSessionToken`,
 * `verifySessionToken` and `SESSION_JWT_SECRET` had no callers left.
 *
 * They were deleted rather than kept "just in case": leaving a working
 * token-minting function next to a system that no longer trusts minted
 * tokens is an invitation to reintroduce exactly the hole P1-031 closed,
 * where anything correctly signed was accepted and revocation could not
 * stop live traffic.
 *
 * What remains is the claims contract itself, which the guard produces
 * and `repositories/auth.ts` consumes.
 */

/** @public */
export type SessionRole = "parent" | "child" | "system";

/** @public */
export interface SessionClaims {
  actorId: string;
  role: SessionRole;
  /**
   * Absent for `role: "system"` (the Verification Engine is a service
   * principal, not a user) and for a parent *bootstrap* session -- one
   * held by an authenticated parent who does not belong to any family
   * yet and may only create one (DISC-P1-031-1).
   */
  familyId?: string;
}
