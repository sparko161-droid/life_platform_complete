import { Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { familyRepository } from "../repositories/index.js";
import { withTransaction } from "../db/pool.js";
import { Session } from "../auth/session.decorator.js";
import { SessionGuard } from "../auth/session.guard.js";
import type { SessionClaims } from "../auth/session.js";
import { RepositoryNotFoundError } from "../repositories/errors.js";

@Controller()
@UseGuards(SessionGuard)
export class FamilyController {
  // POST /families -- createFamily
  @Post("api/v1/families")
  async createFamily(@Session() session: SessionClaims, @Body() body: { ownerParentId: string }) {
    // The frozen contract accepts ownerParentId in the body (there is no
    // existing family membership yet to check against for a brand-new
    // family) -- but it must equal the session's own actor, never an
    // arbitrary id, per the same principle the P1-021 findings exist for.
    if (body.ownerParentId !== session.actorId) {
      throw new ForbiddenException({ error: { code: "OWNER_MUST_BE_SELF", message: "ownerParentId must match the authenticated actor." } });
    }
    return withTransaction((client) =>
      familyRepository.createFamily(client, {
        familyId: randomUUID() as any,
        ownerId: session.actorId as any,
        now: new Date().toISOString(),
      }),
    );
  }

  // GET /families/{familyId} -- getFamily
  @Get("api/v1/families/:familyId")
  async getFamily(@Param("familyId") familyId: string) {
    const family = await withTransaction((client) => familyRepository.readFamily(client, familyId));
    if (!family) throw new RepositoryNotFoundError("Family", familyId);
    return family;
  }

  // POST /families/{familyId}/children -- addChildToFamily
  @Post("api/v1/families/:familyId/children")
  async addChild(
    @Param("familyId") familyId: string,
    @Session() session: SessionClaims,
    @Body() body: { displayName: string; birthYear: number },
  ) {
    const childId = randomUUID();
    const family = await withTransaction((client) =>
      familyRepository.addChild(client, familyId, {
        childId: childId as any,
        displayName: body.displayName,
        birthYear: body.birthYear,
        actorId: session.actorId as any,
        now: new Date().toISOString(),
      }),
    );
    // openapi.yaml's 201 response for this operation is a ChildProfile,
    // not the whole Family the repository returns -- addChild's domain
    // function operates on the Family aggregate, so the new child has to
    // be picked back out of it here.
    const child = family.children.find((c) => c.childId === childId);
    if (!child) throw new RepositoryNotFoundError("ChildProfile", childId);
    return child;
  }
}
