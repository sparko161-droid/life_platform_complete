import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { withTransaction } from "../db/pool.js";
import { resolveSession } from "./session-lookup.js";
import type { SessionClaims } from "./session.js";

export interface RequestWithSession extends Request {
  session?: SessionClaims;
}

/**
 * Verifies the `Authorization: Bearer <sessionId>` header and attaches
 * the resolved claims to the request as `req.session`. Every controller
 * in this service is guarded by this -- there is no endpoint that trusts
 * a client-supplied actor id, which is the point of the P1-021 red-team
 * findings this layer closes.
 *
 * **Changed in P1-031**: the bearer value is now an opaque session
 * identifier resolved against the `sessions` table, not a self-contained
 * signed JWT. That swap is what makes P1-030's revocation actually stop
 * live traffic -- a signature stays valid until it expires, so under the
 * old scheme a revoked parent kept working until their token aged out,
 * and `docs/product/family-lifecycle.md`'s "Revocation immediately
 * invalidates protected access tokens/session grants" was still unmet in
 * practice. See docs/adr/0006-identity-and-session-model.md D2 for the
 * cost this accepts: one lookup per authenticated request.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithSession>();
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException({
        error: { code: "MISSING_SESSION", message: "Authorization: Bearer <token> is required" },
      });
    }

    const bearerValue = header.slice("Bearer ".length);
    const claims = await withTransaction((client) => resolveSession(client, bearerValue, new Date().toISOString()));

    if (!claims) {
      // One response for unknown, expired and revoked. Telling them apart
      // would leak account state to whoever holds a stale identifier.
      throw new UnauthorizedException({
        error: { code: "INVALID_SESSION", message: "Session token is invalid or expired" },
      });
    }

    request.session = claims;
    return true;
  }
}
