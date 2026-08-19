import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Response } from "express";
import { FamilyDomainError, MediaDomainError, RewardDomainError, TaskDomainError } from "@life/domain-types";
import { RepositoryAuthorizationError, RepositoryConflictError, RepositoryNotFoundError } from "../repositories/errors.js";

/**
 * Maps every error class this service can throw to openapi.yaml's stable
 * `ErrorEnvelope` -- "Never expose database errors or provider-specific
 * details" (docs/architecture/api-contracts.md's "Response rules").
 * Nothing reaches a client except `{ code, message }`; a raw pg error or
 * stack trace never does, even on a bug.
 */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, code, message } = classify(exception);
    response.status(status).json({ error: { code, message } });
  }
}

function classify(exception: unknown): { status: number; code: string; message: string } {
  if (exception instanceof RepositoryAuthorizationError) {
    return { status: HttpStatus.FORBIDDEN, code: exception.code, message: "Not authorized for this action." };
  }
  if (exception instanceof RepositoryNotFoundError) {
    return { status: HttpStatus.NOT_FOUND, code: "NOT_FOUND", message: `${exception.entityType} not found.` };
  }
  if (exception instanceof RepositoryConflictError) {
    return { status: HttpStatus.CONFLICT, code: "CONFLICT", message: "This was modified concurrently; refresh and retry." };
  }
  if (
    exception instanceof FamilyDomainError ||
    exception instanceof TaskDomainError ||
    exception instanceof MediaDomainError ||
    exception instanceof RewardDomainError
  ) {
    // 422: the request was well-formed and the actor was authorized, but
    // the state transition itself is invalid (e.g. approving an
    // already-APPROVED assignment) -- a business-rule rejection, not a
    // client input or auth error.
    return { status: HttpStatus.UNPROCESSABLE_ENTITY, code: exception.code, message: exception.message };
  }
  if (exception instanceof HttpException) {
    const body = exception.getResponse();
    if (typeof body === "object" && body !== null && "error" in body) {
      return { status: exception.getStatus(), ...(body as { error: { code: string; message: string } }).error };
    }
    return { status: exception.getStatus(), code: "HTTP_ERROR", message: exception.message };
  }
  // Never leak a raw error message from an unexpected exception.
  return { status: HttpStatus.INTERNAL_SERVER_ERROR, code: "INTERNAL_ERROR", message: "Something went wrong." };
}
