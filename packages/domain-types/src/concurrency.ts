import type { Family } from "./family.js";
import type { Reward } from "./reward.js";
import type { TaskAssignment, TaskTemplate } from "./task.js";

/**
 * Vertical slice state, idempotency and conflict fixtures (P1-015).
 *
 * Implements the optimistic concurrency contract described in
 * docs/architecture/concurrency-and-conflicts.md:
 *
 *   "Use optimistic version checks for mutable aggregates and return an
 *    explicit conflict when the submitted version is stale."
 *
 * and docs/architecture/vertical-slice/state-trace.md:
 *
 *   "Parent and child may act concurrently. The server validates the
 *    current version and policy. A stale action returns a conflict result
 *    and the UI refreshes instead of silently overwriting another actor's
 *    change."
 *
 * The domain layer does NOT touch the database — it cannot enforce the
 * uniqueness constraint alone. However, it provides:
 *
 *   1. `checkVersion()` — compares the submitted version against the
 *      current aggregate version and throws `StaleVersionError` when stale.
 *      The application layer calls this with the aggregate it just read
 *      from the DB inside a transaction, before calling any mutating
 *      domain service function.
 *
 *   2. `StaleVersionError` — typed error the application layer maps to
 *      an HTTP 409 Conflict response so the client can refresh and retry.
 *
 *   3. `ConflictScenario` — structured descriptions of the known race
 *      conditions in the vertical slice, with the expected resolution for
 *      each. Tests import this to assert the documented behavior.
 *
 * See also: packages/domain-types/src/idempotency.ts for idempotency-key
 * based protection against duplicate writes.
 */

// ---------------------------------------------------------------------------
// Stale-version error
// ---------------------------------------------------------------------------

export class StaleVersionError extends Error {
  constructor(
    public readonly entityType: string,
    public readonly entityId: string,
    public readonly submittedVersion: number,
    public readonly currentVersion: number,
  ) {
    super(
      `Stale version for ${entityType} ${entityId}: submitted ${submittedVersion}, current ${currentVersion}`,
    );
    this.name = "StaleVersionError";
  }
}

// ---------------------------------------------------------------------------
// Version check
// ---------------------------------------------------------------------------

/**
 * Checks that the client-submitted version matches the currently-stored
 * version. Throws `StaleVersionError` when there is a mismatch.
 *
 * Usage (application layer, inside a DB transaction):
 *
 * ```typescript
 * const current = await db.taskAssignments.getById(id);
 * checkVersion("TaskAssignment", id, submittedVersion, current.version);
 * const { next } = startTask(current, command);
 * await db.taskAssignments.update(next);
 * ```
 *
 * @throws {StaleVersionError}
 */
export function checkVersion(
  entityType: string,
  entityId: string,
  submittedVersion: number,
  currentVersion: number,
): void {
  if (submittedVersion !== currentVersion) {
    throw new StaleVersionError(entityType, entityId, submittedVersion, currentVersion);
  }
}

// ---------------------------------------------------------------------------
// Typed aggregate version-check shortcuts
// ---------------------------------------------------------------------------

/** Checks that the submitted TaskAssignment version is current. */
export function checkAssignmentVersion(
  assignment: TaskAssignment,
  submittedVersion: number,
): void {
  checkVersion(
    "TaskAssignment",
    assignment.taskAssignmentId,
    submittedVersion,
    assignment.version,
  );
}

/** Checks that the submitted Family version is current. */
export function checkFamilyVersion(
  family: Family,
  submittedVersion: number,
): void {
  checkVersion("Family", family.familyId, submittedVersion, family.version);
}

/** Checks that the submitted Reward version is current. */
export function checkRewardVersion(
  reward: Reward,
  submittedVersion: number,
): void {
  checkVersion("Reward", reward.rewardId, submittedVersion, reward.version);
}

/** Checks that the submitted TaskTemplate version is current. */
export function checkTemplateVersion(
  template: TaskTemplate,
  submittedVersion: number,
): void {
  checkVersion(
    "TaskTemplate",
    template.taskTemplateId,
    submittedVersion,
    template.version,
  );
}

// ---------------------------------------------------------------------------
// Known conflict scenarios (vertical slice test matrix)
// ---------------------------------------------------------------------------

/**
 * Structured descriptions of the race conditions that must be covered by
 * the vertical slice fixture suite. Each scenario names:
 *   - `scenario`: the race condition
 *   - `actors`: who is involved
 *   - `resolution`: the expected outcome per docs/architecture
 *   - `mechanism`: how the system prevents a double effect
 *
 * Tests import `CONFLICT_SCENARIOS` and assert the documented resolution.
 * See docs/architecture/vertical-slice/test-matrix.md.
 */
export const CONFLICT_SCENARIOS = [
  {
    scenario: "Two parents approve the same completion concurrently",
    actors: ["parent-A", "parent-B"],
    resolution: "First write wins; second write receives StaleVersionError (stale assignment version)",
    mechanism: "optimistic-version",
    reference: "docs/architecture/concurrency-and-conflicts.md: 'Two parents approve one completion: only one canonical approval effect.'",
  },
  {
    scenario: "Child re-submits while parent is reviewing",
    actors: ["child", "parent"],
    resolution: "Child's re-submit fails SUBMIT_TASK_WRONG_STATUS (status is VERIFYING, not IN_PROGRESS)",
    mechanism: "state-machine",
    reference: "task-service.ts: submitTask requires IN_PROGRESS status",
  },
  {
    scenario: "Parent approves while another parent rejects concurrently",
    actors: ["parent-A (approve)", "parent-B (reject)"],
    resolution: "First write wins; second write receives StaleVersionError (stale version from the DB check)",
    mechanism: "optimistic-version",
    reference: "docs/architecture/concurrency-and-conflicts.md: optimistic version checks for mutable aggregates",
  },
  {
    scenario: "Child initiates reward redemption while parent archives the reward",
    actors: ["child (initiate)", "parent (cancel/expire)"],
    resolution: "First write wins; second write fails on stale Reward version",
    mechanism: "optimistic-version",
    reference: "docs/architecture/concurrency-and-conflicts.md: 'Reward deleted while child redeems: redemption is accepted or rejected atomically'",
  },
  {
    scenario: "Same completion XP/COINS grant delivered twice (event re-delivery)",
    actors: ["system"],
    resolution: "Second delivery returns duplicate:true; ledger entry is not created again",
    mechanism: "idempotency-key",
    reference: "reward-service.ts: taskCompletionRewardKey prevents double-grant",
  },
  {
    scenario: "Network timeout: child submits task, server writes but client retries",
    actors: ["child"],
    resolution: "Retry finds status=SUBMITTED (not IN_PROGRESS); domain rejects with SUBMIT_TASK_WRONG_STATUS; client re-reads and shows submitted state",
    mechanism: "state-machine",
    reference: "state-trace.md: 'After reconnect, the client requests the current task state.'",
  },
] as const;

export type ConflictScenario = (typeof CONFLICT_SCENARIOS)[number];
export type ConflictMechanism = ConflictScenario["mechanism"];
