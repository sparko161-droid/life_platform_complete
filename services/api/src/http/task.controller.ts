import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { rewardRepository, taskRepository } from "../repositories/index.js";
import { withTransaction } from "../db/pool.js";
import { Session } from "../auth/session.decorator.js";
import { SessionGuard } from "../auth/session.guard.js";
import type { SessionClaims } from "../auth/session.js";
import { RepositoryNotFoundError } from "../repositories/errors.js";
import {
  assertChildInFamily,
  assertFamily,
  loadAssignmentInScope,
  loadTemplateInScope,
  requireParent,
  resolveChildScope,
} from "../auth/scope.js";
import { buildCursorPage, decodeCursor } from "./pagination.js";

@Controller()
@UseGuards(SessionGuard)
export class TaskController {
  // GET /families/{familyId}/task-templates -- listTaskTemplates
  @Get("api/v1/families/:familyId/task-templates")
  async listTaskTemplates(
    @Param("familyId") familyId: string,
    @Session() session: SessionClaims,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    assertFamily(session, familyId);
    const pageSize = clampLimit(limit);
    const rows = await withTransaction((client) =>
      taskRepository.listTaskTemplatesByFamily(client, familyId, {
        limit: pageSize + 1,
        ...(cursor ? { afterCreatedAt: decodeCursor(cursor) } : {}),
      }),
    );
    return buildCursorPage(rows, pageSize, (t) => t.createdAt);
  }

  // POST /families/{familyId}/task-templates -- createTaskTemplate
  @Post("api/v1/families/:familyId/task-templates")
  async createTaskTemplate(
    @Param("familyId") familyId: string,
    @Session() session: SessionClaims,
    @Body()
    body: { title: string; verificationStrategy: string; rewardXp: number; rewardCoins: number },
  ) {
    assertFamily(session, familyId);
    requireParent(session);
    return withTransaction((client) =>
      taskRepository.createTemplate(client, {
        taskTemplateId: randomUUID() as any,
        familyId: familyId as any,
        createdByParentId: session.actorId as any,
        title: body.title,
        verificationStrategy: body.verificationStrategy as any,
        rewardXp: body.rewardXp,
        rewardCoins: body.rewardCoins,
        now: new Date().toISOString(),
      }),
    );
  }

  // POST /task-templates/{taskTemplateId}/publish -- publishTaskTemplate
  @Post("api/v1/task-templates/:taskTemplateId/publish")
  @HttpCode(200)
  async publishTaskTemplate(
    @Param("taskTemplateId") taskTemplateId: string,
    @Session() session: SessionClaims,
    @Headers("idempotency-key") _idempotencyKey: string,
  ) {
    requireParent(session);
    return withTransaction(async (client) => {
      const current = await loadTemplateInScope(client, session, taskTemplateId);
      // Idempotent replay: already ACTIVE returns unchanged rather than
      // failing PUBLISH_TEMPLATE_INVALID_TRANSITION, same rule as
      // startTaskAssignment's repeat taps.
      if (current.status === "ACTIVE") return current;
      return taskRepository.publishTemplate(client, taskTemplateId, {
        actorId: session.actorId as any,
        now: new Date().toISOString(),
      });
    });
  }

  // POST /task-templates/{taskTemplateId}/assignments -- assignTask
  @Post("api/v1/task-templates/:taskTemplateId/assignments")
  async assignTask(
    @Param("taskTemplateId") taskTemplateId: string,
    @Session() session: SessionClaims,
    @Body() body: { assignedToChildId: string; dueAt?: string },
  ) {
    requireParent(session);
    return withTransaction(async (client) => {
      // Both ends are checked: the template must be this family's, and
      // so must the child. Guarding only one would let a caller assign
      // their own template to someone else's child, or someone else's
      // template to their own.
      await loadTemplateInScope(client, session, taskTemplateId);
      await assertChildInFamily(client, session, body.assignedToChildId);
      return taskRepository.assignTask(client, taskTemplateId, {
        taskAssignmentId: randomUUID() as any,
        assignedToChildId: body.assignedToChildId as any,
        actorId: session.actorId as any,
        ...(body.dueAt ? { dueAt: body.dueAt } : {}),
        now: new Date().toISOString(),
      });
    });
  }

  // GET /task-assignments/{taskAssignmentId} -- getTaskAssignment
  @Get("api/v1/task-assignments/:taskAssignmentId")
  async getTaskAssignment(@Param("taskAssignmentId") taskAssignmentId: string, @Session() session: SessionClaims) {
    return withTransaction((client) => loadAssignmentInScope(client, session, taskAssignmentId));
  }

  // POST /task-assignments/{taskAssignmentId}/completions -- submitTaskCompletion
  @Post("api/v1/task-assignments/:taskAssignmentId/completions")
  async submitCompletion(
    @Param("taskAssignmentId") taskAssignmentId: string,
    @Session() session: SessionClaims,
    @Headers("idempotency-key") _idempotencyKey: string,
    @Body() body: { mediaEvidenceId?: string; counterValue?: number; timerSeconds?: number; selfReportNote?: string },
  ) {
    const { completion } = await withTransaction(async (client) => {
      await loadAssignmentInScope(client, session, taskAssignmentId);
      return taskRepository.submitTask(client, taskAssignmentId, {
        taskCompletionId: randomUUID() as any,
        actorId: session.actorId as any,
        ...(body.mediaEvidenceId ? { mediaEvidenceId: body.mediaEvidenceId as any } : {}),
        ...(body.counterValue !== undefined ? { counterValue: body.counterValue } : {}),
        ...(body.timerSeconds !== undefined ? { timerSeconds: body.timerSeconds } : {}),
        ...(body.selfReportNote ? { selfReportNote: body.selfReportNote } : {}),
        now: new Date().toISOString(),
      });
    });
    return completion;
  }

  // POST /task-assignments/{taskAssignmentId}/start -- startTaskAssignment
  @Post("api/v1/task-assignments/:taskAssignmentId/start")
  @HttpCode(200)
  async start(
    @Param("taskAssignmentId") taskAssignmentId: string,
    @Session() session: SessionClaims,
    @Headers("idempotency-key") _idempotencyKey: string,
  ) {
    return withTransaction(async (client) => {
      const current = await loadAssignmentInScope(client, session, taskAssignmentId);
      // Idempotent replay: "repeat taps must not create duplicate
      // attempts" (docs/ux/core-path-contracts.md) -- already IN_PROGRESS
      // returns the current state instead of erroring.
      if (current.status === "IN_PROGRESS") return current;
      return taskRepository.startTask(client, taskAssignmentId, { actorId: session.actorId as any, now: new Date().toISOString() });
    });
  }

  // POST /task-assignments/{taskAssignmentId}/approve -- approveTaskCompletion
  @Post("api/v1/task-assignments/:taskAssignmentId/approve")
  @HttpCode(200)
  async approve(
    @Param("taskAssignmentId") taskAssignmentId: string,
    @Session() session: SessionClaims,
    @Headers("idempotency-key") _idempotencyKey: string,
  ) {
    // A child must not approve their own work. Nothing checked this
    // before, so a child session could approve its own assignment and
    // grant itself the reward below -- the approval step existed but
    // decided nothing.
    requireParent(session);
    return withTransaction(async (client) => {
      const current = await loadAssignmentInScope(client, session, taskAssignmentId);
      // Idempotent replay: "does not grant the reward a second time"
      // (task-to-reward.md) -- already APPROVED (or further along)
      // returns the current state; the reward grant below is also
      // independently idempotency-key protected as defense in depth.
      if (current.status === "APPROVED" || current.status === "COMPLETED") return current;

      const now = new Date().toISOString();
      const verifying =
        current.status === "SUBMITTED"
          ? await taskRepository.beginVerification(client, taskAssignmentId, session.actorId, now)
          : current;
      const approved = await taskRepository.verifyTask(client, verifying.taskAssignmentId, {
        actorId: session.actorId as any,
        outcome: "APPROVED",
        now,
      });
      const completed = await taskRepository.completeTask(client, approved.taskAssignmentId, session.actorId, now);

      const template = await taskRepository.loadTaskTemplate(client, completed.taskTemplateId);
      if (template) {
        await rewardRepository.grantTaskReward(client, {
          familyId: completed.familyId as any,
          childId: completed.assignedToChildId as any,
          sourceTaskAssignmentId: completed.taskAssignmentId as any,
          xpAmount: template.rewardXp,
          coinsAmount: template.rewardCoins,
          now,
        });
      }
      return completed;
    });
  }

  // POST /task-assignments/{taskAssignmentId}/reject -- rejectTaskCompletion
  @Post("api/v1/task-assignments/:taskAssignmentId/reject")
  @HttpCode(200)
  async reject(
    @Param("taskAssignmentId") taskAssignmentId: string,
    @Session() session: SessionClaims,
    @Headers("idempotency-key") _idempotencyKey: string,
    @Body() _body: { comment: string },
  ) {
    // The rejection comment ("shown to the child as the reason to try
    // again") has nowhere to persist yet -- verifyTask/VerificationResult
    // do not carry it, and no repository writes verification_results
    // rows at all today. Accepted but not yet stored; recorded as a
    // known follow-up rather than silently dropped without disclosure
    // (see this task's handoff).
    requireParent(session);
    return withTransaction(async (client) => {
      const current = await loadAssignmentInScope(client, session, taskAssignmentId);
      if (current.status === "REJECTED") return current;

      const now = new Date().toISOString();
      const verifying =
        current.status === "SUBMITTED"
          ? await taskRepository.beginVerification(client, taskAssignmentId, session.actorId, now)
          : current;
      return taskRepository.verifyTask(client, verifying.taskAssignmentId, {
        actorId: session.actorId as any,
        outcome: "REJECTED",
        now,
      });
    });
  }

  // GET /child/today -- getChildToday
  //
  // childId is a *query parameter*, which means it is a claim by the
  // caller. openapi.yaml says this view is "scoped to the requesting
  // child's own assignments only", and until P1-004 nothing enforced
  // that: any child session could read any child's day by changing one
  // value in the URL. The session decides the scope here instead.
  //
  // It stays a parameter rather than being dropped because a parent
  // legitimately reads a child's day -- but then the child must be one
  // of theirs, which is checked against the family the session is
  // scoped to ("Family is the security boundary for child data",
  // docs/product/actors-and-permissions.md).
  @Get("api/v1/child/today")
  async today(@Session() session: SessionClaims, @Query("childId") childId?: string) {
    const targetChildId = await withTransaction((client) => resolveChildScope(client, session, childId));
    const { assignments, everHadTasks } = await withTransaction(async (client) => ({
      assignments: await taskRepository.listTodayCardsByChild(client, targetChildId),
      everHadTasks: await taskRepository.hasEverBeenAssigned(client, targetChildId),
    }));
    return { childId: targetChildId, assignments, everHadTasks, generatedAt: new Date().toISOString() };
  }
}

function clampLimit(raw: string | undefined): number {
  const n = raw ? Number(raw) : 20;
  if (!Number.isFinite(n) || n < 1) return 20;
  return Math.min(n, 100);
}
