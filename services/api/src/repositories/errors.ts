/**
 * Repository-layer error types (P1-025).
 *
 * Distinct from the domain layer's *DomainError classes
 * (packages/domain-types) -- those model a business-rule violation given
 * correct inputs (e.g. "cannot approve a REJECTED task"); these model a
 * request that never should have reached the domain layer at all
 * (unauthorized actor, or a write that lost a race). P1-026's HTTP
 * handlers are expected to map RepositoryAuthorizationError -> 403,
 * RepositoryConflictError -> 409, RepositoryNotFoundError -> 404, and any
 * *DomainError -> 422/409 depending on its code.
 */

export class RepositoryAuthorizationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RepositoryAuthorizationError";
  }
}

export class RepositoryNotFoundError extends Error {
  constructor(
    public readonly entityType: string,
    public readonly entityId: string,
  ) {
    super(`${entityType} ${entityId} not found`);
    this.name = "RepositoryNotFoundError";
  }
}

/**
 * Raised when an `UPDATE ... WHERE version = $n` affects zero rows --
 * defense in depth alongside the `SELECT ... FOR UPDATE` row lock every
 * repository method takes first (docs/architecture/concurrency-and-conflicts.md;
 * closes DISC-P1-021-2/RT-010: the pure domain layer's checkVersion is
 * necessary but not self-enforcing, this is what enforces it).
 */
export class RepositoryConflictError extends Error {
  constructor(
    public readonly entityType: string,
    public readonly entityId: string,
  ) {
    super(`Conflict: ${entityType} ${entityId} was modified concurrently`);
    this.name = "RepositoryConflictError";
  }
}
