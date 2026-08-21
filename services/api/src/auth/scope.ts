import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { PoolClient } from "pg";
import { familyRepository, rewardRepository, taskRepository } from "../repositories/index.js";
import type { SessionClaims } from "./session.js";

/**
 * Family-scope authorization (P1-037, from DISC-P1-004-2).
 *
 * "Family is the security boundary for child data"
 * (docs/product/actors-and-permissions.md). Every controller asserted
 * that in its OpenAPI summary and none of them enforced it: an
 * authenticated session could read or act on any family's data by
 * supplying its id. DISC-P1-004-1 fixed one endpoint; this module is the
 * sweep, so the rule lives in one place instead of being re-derived
 * (and eventually re-forgotten) per handler.
 *
 * Two rules run through all of it:
 *
 * 1. **Not-found and not-yours fail identically.** Distinguishing them
 *    turns every endpoint into an oracle for which ids are real.
 * 2. **Resources are located by loading them, then checking their
 *    familyId** -- never by trusting a family id in the path. A caller
 *    controls the path; they do not control what the row says.
 */

const DENIED = {
  error: { code: "NOT_IN_FAMILY", message: "Нет доступа к этим данным." },
} as const;

function deny(): never {
  throw new ForbiddenException(DENIED);
}

/** The family this session may act in, or a refusal if it has none. */
function requireFamilyScope(session: SessionClaims): string {
  if (!session.familyId) {
    // A bootstrap session may only create a family (ADR-0006 constraint
    // 3, DISC-P1-031-1). Everything guarded here is family-scoped by
    // definition, so there is nothing it could legitimately reach.
    deny();
  }
  return session.familyId;
}

/** Refuses unless the session is scoped to exactly this family. */
export function assertFamily(session: SessionClaims, familyId: string): void {
  if (requireFamilyScope(session) !== familyId) deny();
}

/** Refuses unless the caller is a parent. */
export function requireParent(session: SessionClaims): void {
  if (session.role !== "parent") {
    throw new ForbiddenException({
      error: { code: "PARENT_SESSION_REQUIRED", message: "Это действие доступно только взрослому." },
    });
  }
}

export async function assertChildInFamily(
  client: PoolClient,
  session: SessionClaims,
  childId: string,
): Promise<void> {
  const familyId = requireFamilyScope(session);
  // A child is only ever in scope for themselves; a parent, for any
  // child of the family their session is scoped to.
  if (session.role === "child") {
    if (childId !== session.actorId) deny();
    return;
  }
  const family = await familyRepository.readFamily(client, familyId);
  if (!family?.children.some((c) => c.childId === childId)) deny();
}

export async function loadTemplateInScope(client: PoolClient, session: SessionClaims, taskTemplateId: string) {
  const template = await taskRepository.loadTaskTemplate(client, taskTemplateId);
  // Missing and out-of-scope produce the same refusal, so a caller
  // cannot use this endpoint to discover which template ids exist.
  if (!template || template.familyId !== requireFamilyScope(session)) deny();
  return template;
}

export async function loadAssignmentInScope(client: PoolClient, session: SessionClaims, taskAssignmentId: string) {
  const assignment = await taskRepository.readTaskAssignment(client, taskAssignmentId);
  if (!assignment || assignment.familyId !== requireFamilyScope(session)) deny();
  // Within a family, a child still only reaches their own assignments:
  // they are CHILD_PRIVATE (TASK_ASSIGNMENT_CLASSIFICATION), and a
  // sibling is inside the family boundary but not inside that one.
  if (session.role === "child" && assignment.assignedToChildId !== session.actorId) deny();
  return assignment;
}

export async function loadRewardInScope(client: PoolClient, session: SessionClaims, rewardId: string) {
  const reward = await rewardRepository.loadReward(client, rewardId);
  if (!reward || reward.familyId !== requireFamilyScope(session)) deny();
  return reward;
}

/**
 * Resolves whose child data a caller is asking about.
 *
 * A child never names anyone: their session already says who they are,
 * and a mismatched id is refused rather than silently corrected --
 * substituting the right one would hide a client bug, and honouring the
 * requested one is the vulnerability.
 */
export async function resolveChildScope(
  client: PoolClient,
  session: SessionClaims,
  requested: string | undefined,
): Promise<string> {
  if (session.role === "child") {
    if (requested && requested !== session.actorId) deny();
    return session.actorId;
  }
  if (!requested) {
    throw new BadRequestException({ error: { code: "INVALID_INPUT", message: "Укажите ребёнка." } });
  }
  await assertChildInFamily(client, session, requested);
  return requested;
}
