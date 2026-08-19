import { type ExecutionContext, createParamDecorator } from "@nestjs/common";
import type { SessionClaims } from "./session.js";
import type { RequestWithSession } from "./session.guard.js";

/**
 * Injects the verified session claims (attached by SessionGuard) into a
 * controller method parameter: `approve(@Session() session: SessionClaims, ...)`.
 */
export const Session = createParamDecorator((_data: unknown, ctx: ExecutionContext): SessionClaims => {
  const request = ctx.switchToHttp().getRequest<RequestWithSession>();
  if (!request.session) {
    throw new Error("Session accessed before SessionGuard ran -- guard is missing on this route");
  }
  return request.session;
});
