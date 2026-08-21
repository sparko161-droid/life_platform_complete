import { Controller, Get, Headers, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";
import { rewardRepository } from "../repositories/index.js";
import { withTransaction } from "../db/pool.js";
import { Session } from "../auth/session.decorator.js";
import { SessionGuard } from "../auth/session.guard.js";
import type { SessionClaims } from "../auth/session.js";
import { loadRewardInScope, resolveChildScope } from "../auth/scope.js";
import { buildCursorPage, decodeCursor } from "./pagination.js";

@Controller()
@UseGuards(SessionGuard)
export class RewardController {
  // GET /children/{childId}/reward-ledger -- listRewardLedger
  @Get("api/v1/children/:childId/reward-ledger")
  async listLedger(
    @Param("childId") childId: string,
    @Session() session: SessionClaims,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    const pageSize = clampLimit(limit);
    const rows = await withTransaction(async (client) => {
      // A ledger is a child's own earnings history; the same scoping
      // rule as /child/today applies, and for the same reason.
      const target = await resolveChildScope(client, session, childId);
      return rewardRepository.listRewardLedgerByChild(client, target, {
        limit: pageSize + 1,
        ...(cursor ? { afterPostedAt: decodeCursor(cursor) } : {}),
      });
    });
    return buildCursorPage(rows, pageSize, (e) => e.postedAt);
  }

  // POST /rewards/{rewardId}/redeem -- redeemReward
  // "AVAILABLE -> REDEEMING immediately; REDEEMED follows once the
  // redemption settles" (openapi.yaml) -- this endpoint is the
  // AVAILABLE -> REDEEMING half (initiateRedemption); confirmRedemption
  // (REDEEMING -> REDEEMED, the parent-confirmed settlement) has no
  // exposed operation in the frozen contract yet.
  @Post("api/v1/rewards/:rewardId/redeem")
  @HttpCode(200)
  async redeem(
    @Param("rewardId") rewardId: string,
    @Session() session: SessionClaims,
    @Headers("idempotency-key") _idempotencyKey: string,
  ) {
    // initiateRedemption itself carries no idempotency-key parameter
    // (only confirmRedemption's eventual settlement does, per
    // packages/domain-types/src/idempotency.ts); "cannot be duplicated by
    // retries" is satisfied here by the status check below instead --
    // already REDEEMING or REDEEMED returns the current state rather
    // than erroring on a repeat.
    return withTransaction(async (client) => {
      const current = await loadRewardInScope(client, session, rewardId);
      if (current.status === "REDEEMING" || current.status === "REDEEMED") return current;
      return rewardRepository.initiateRedemption(client, rewardId, {
        familyId: current.familyId,
        childId: session.actorId as any,
        now: new Date().toISOString(),
      });
    });
  }
}

function clampLimit(raw: string | undefined): number {
  const n = raw ? Number(raw) : 20;
  if (!Number.isFinite(n) || n < 1) return 20;
  return Math.min(n, 100);
}
