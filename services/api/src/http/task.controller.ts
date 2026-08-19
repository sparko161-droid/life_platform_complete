import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { rewardRepository, taskRepository } from "../repositories/index.js";
import { withTransaction } from "../db/pool.js";
import { Session } from "../auth/session.decorator.js";
import { SessionGuard } from "../auth/session.guard.js";
import type { SessionClaims } from "../auth/session.js";
import { RepositoryNotFoundError } from "../repositories/errors.js";
import { buildCursorPage, decodeCursor } from "./pagination.js";

@Controller()
@UseGuards(SessionGuard)
export class TaskController {
  // GET /families/{familyId}/task-templates -- listTaskTemplates
  @Get("api/v1/families/:familyId/task-templates")
  async listTaskTemplates(@Param("familyId") familyId: string, @Query("cursor") cursor?: string, @Query("limit") limit?: string) {
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

  // POST /task-templates/{taskTemplateId}/assignments -- assignTask
  @Post("api/v1/task-templates/:taskTemplateId/assignments")
  async assignTask(
    @Param("taskTemplateId") taskTemplateId: string,
    @Session() session: SessionClaims,
    @Body() body: { assignedToChildId: string; dueAt?: string },
  ) {
    return withTransaction((client) =>
      taskRepository.assignTask(client, taskTemplateId, {
        taskAssignmentId: randomUUID() as any,
        assignedToChildId: body.assignedToChildId as any,
        actorId: session.actorId as any,
        ...(body.dueAt ? { dueAt: body.dueAt } : {}),
        now: new Date().toISOString(),
      }),
    );
  }

  // GET /task-assignments/{taskAssignmentId} -- getTaskAssignment
  @Get("api/v1/task-assignments/:taskAssignmentId")
  async getTaskAssignment(@Param("taskAssignmentId") taskAssignmentId: string) {
    const assignment = await withTransaction((client) => taskRepository.readTaskAssignment(client, taskAssignmentId));
    if (!assignment) throw new RepositoryNotFoundError("TaskAssignment", taskAssignmentId);
    return assignment;
  }

  // POST /task-assignments/{taskAssignmentId}/completions -- submitTaskCompletion
  @Post("api/v1/task-assignments/:taskAssignmentId/completions")
  async submitCompletion(
    @Param("taskAssignmentId") taskAssignmentId: string,
    @Session() session: SessionClaims,
    @Headers("idempotency-key") _idempotencyKey: string,
    @Body() body: { mediaEvidenceId?: string; counterValue?: number; timerSeconds?: number; selfReportNote?: string },
  ) {
    const { completion } = await withTransaction((client) =>
      taskRepository.submitTask(client, taskAssignmentId, {
        taskCompletionId: randomUUID() as any,
        actorId: session.actorId as any,
        ...(body.mediaEvidenceId ? { mediaEvidenceId: body.mediaEvidenceId as any } : {}),
        ...(body.counterValue !== undefined ? { counterValue: body.counterValue } : {}),
        ...(body.timerSeconds !== undefined ? { timerSeconds: body.timerSeconds } : {}),
        ...(body.selfReportNote ? { selfReportNote: body.selfReportNote } : {}),
        now: new Date().toISOString(),
      }),
    );
    return completion;
  }

  // POST /task-assignments/{taskAssignmentId}/start -- startTaskAssignment
  @Post("api/v1/task-assignments/:taskAssignmentId/start")
  async start(
    @Param("taskAssignmentId") taskAssignmentId: string,
    @Session() session: SessionClaims,
    @Headers("idempotency-key") _idempotencyKey: string,
  ) {
    return withTransaction(async (client) => {
      const current = await taskRepository.readTaskAssignment(client, taskAssignmentId);
      if (!current) throw new RepositoryNotFoundError("TaskAssignment", taskAssignmentId);
      // Idempotent replay: "repeat taps must not create duplicate
      // attempts" (docs/ux/core-path-contracts.md) -- already IN_PROGRESS
      // returns the current state instead of erroring.
      if (current.status === "IN_PROGRESS") return current;
      return taskRepository.startTask(client, taskAssignmentId, { actorId: session.actorId as any, now: new Date().toISOString() });
    });
  }

  // POST /task-assignments/{taskAssignmentId}/approve -- approveTaskCompletion
  @Post("api/v1/task-assignments/:taskAssignmentId/approve")
  async approve(
    @Param("taskAssignmentId") taskAssignmentId: string,
    @Session() session: SessionClaims,
    @Headers("idempotency-key") _idempotencyKey: string,
  ) {
    return withTransaction(async (client) => {
      const current = await taskRepository.readTaskAssignment(client, taskAssignmentId);
      if (!current) throw new RepositoryNotFoundError("TaskAssignment", taskAssignmentId);
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
    return withTransaction(async (client) => {
      const current = await taskRepository.readTaskAssignment(client, taskAssignmentId);
      if (!current) throw new RepositoryNotFoundError("TaskAssignment", taskAssignmentId);
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
  @Get("api/v1/child/today")
  async today(@Query("childId") childId: string) {
    const assignments = await withTransaction((client) => taskRepository.listActiveAssignmentsByChild(client, childId));
    return { childId, assignments, generatedAt: new Date().toISOString() };
  }
}

function clampLimit(raw: string | undefined): number {
  const n = raw ? Number(raw) : 20;
  if (!Number.isFinite(n) || n < 1) return 20;
  return Math.min(n, 100);
}
