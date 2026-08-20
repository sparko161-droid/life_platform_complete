/**
 * Session cookie policy (P1-010).
 *
 * The API issues an opaque session id that maps to a revocable
 * server-side record -- P1-031 replaced the earlier JWT, see
 * docs/adr/0006-identity-and-session-model.md D2. The browser must never
 * be able to read it: a child device is frequently a
 * shared device, and an XSS on a child surface that yields a session
 * token would hand an attacker the child's whole family scope. So the
 * token lives in an **httpOnly** cookie that only the Next server can
 * read, and the browser talks to a same-origin proxy route instead of
 * calling the API directly with an Authorization header.
 *
 * This is the security posture confirmed in
 * tasks/packets/P1-FRONTEND-web-app-pack.md, and it is why there is no
 * `getTokenForClient()` anywhere in this package -- the absence is the
 * feature.
 *
 * Related policy: docs/security/effective-policy.md ("UI visibility is
 * never an authorization mechanism"), docs/security/permissions.md
 * ("Server-side policy is authoritative. Client-side gating is UX
 * only").
 */

export const SESSION_COOKIE_NAME = "life_session";

export interface SessionCookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax" | "strict";
  path: string;
  maxAge: number;
}

/**
 * Cookie attributes for the session token.
 *
 * - `httpOnly` is hard-coded `true`, not a parameter: a caller must not
 *   be able to opt out of the one property this design depends on.
 * - `sameSite: "strict"` because no third-party site has any legitimate
 *   reason to trigger an authenticated request here; there is no OAuth
 *   redirect or cross-site embed in Phase 1 that `lax` would be needed
 *   for.
 * - `secure` follows the environment so local http development works,
 *   but defaults to on anywhere that is not explicitly development --
 *   the safe direction to be wrong in.
 */
export function sessionCookieOptions(opts: { isDevelopment?: boolean; maxAgeSeconds?: number } = {}): SessionCookieOptions {
  return {
    httpOnly: true,
    secure: !opts.isDevelopment,
    sameSite: "strict",
    path: "/",
    // Matches DEFAULT_SESSION_TTL_SECONDS in the API (1h). A cookie that
    // outlives the session record would leave the user "logged in" with
    // an id the API rejects, which reads as a broken app rather than an
    // expiry.
    maxAge: opts.maxAgeSeconds ?? 3600,
  };
}

/** Attributes that clear the cookie. Same flags, zero lifetime. */
export function clearedSessionCookieOptions(opts: { isDevelopment?: boolean } = {}): SessionCookieOptions {
  return { ...sessionCookieOptions(opts), maxAge: 0 };
}
