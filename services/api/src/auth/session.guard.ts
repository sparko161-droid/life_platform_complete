import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { InvalidSessionError, type SessionClaims, verifySessionToken } from "./session.js";

export interface RequestWithSession extends Request {
  session?: SessionClaims;
}

/**
 * Verifies the `Authorization: Bearer <token>` header (openapi.yaml's
 * `BearerAuth` scheme) and attaches the decoded claims to the request as
 * `req.session`. Every controller in this service is guarded by this --
 * there is no endpoint that trusts a client-supplied actor id, per the
 * whole point of the P1-021 red-team findings this API layer closes.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithSession>();
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException({ error: { code: "MISSING_SESSION", message: "Authorization: Bearer <token> is required" } });
    }
    const token = header.slice("Bearer ".length);
    try {
      request.session = verifySessionToken(token);
      return true;
    } catch (err) {
      if (err instanceof InvalidSessionError) {
        throw new UnauthorizedException({ error: { code: "INVALID_SESSION", message: "Session token is invalid or expired" } });
      }
      throw err;
    }
  }
}
