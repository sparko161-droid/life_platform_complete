/**
 * HTTP layer end-to-end tests (P1-026).
 *
 * Real Postgres + a real running Nest application (via @nestjs/testing +
 * supertest), not mocks. Same graceful-skip pattern as
 * repositories.test.ts: if DATABASE_URL is unreachable, every test skips
 * with a clear reason instead of failing noisily.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import "reflect-metadata";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { createRealChildSession, createRealParentSession } from "./helpers/real-session.js";
import { closePool, getPool } from "../src/db/pool.js";

let dbAvailable = false;
let app: INestApplication | undefined;

before(async () => {
  try {
    await getPool().query("SELECT 1");
    const tableCheck = await getPool().query("SELECT to_regclass('public.families') AS exists");
    dbAvailable = Boolean(tableCheck.rows[0]?.exists);
  } catch {
    dbAvailable = false;
  }
  if (!dbAvailable) {
    console.log("\n[http.e2e.test.ts] DATABASE_URL unreachable or unmigrated. Skipping -- needs a real Postgres.");
    return;
  }
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
});

after(async () => {
  if (app) await app.close();
  await closePool();
});

function skipIfNoDb(t: { skip: (reason?: string) => void }): boolean {
  if (!dbAvailable || !app) {
    t.skip("DATABASE_URL unreachable in this environment");
    return true;
  }
  return false;
}

test("GET /api/v1/health returns ok with no auth required", async (t) => {
  if (skipIfNoDb(t)) return;
  const res = await request(app!.getHttpServer()).get("/api/v1/health");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: "ok" });
});

test("POST /api/v1/families rejects a missing session", async (t) => {
  if (skipIfNoDb(t)) return;
  const res = await request(app!.getHttpServer()).post("/api/v1/families").send({ ownerParentId: randomUUID() });
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, "MISSING_SESSION");
});

test("POST /api/v1/families rejects ownerParentId that does not match the session actor", async (t) => {
  if (skipIfNoDb(t)) return;
  const parent = await createRealParentSession();
  const res = await request(app!.getHttpServer())
    .post("/api/v1/families")
    .set("Authorization", `Bearer ${parent.sessionId}`)
    .send({ ownerParentId: randomUUID() }); // someone else's id
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, "OWNER_MUST_BE_SELF");
});

test("a self-minted token is rejected -- the bearer value must be a real session record", async (t) => {
  if (skipIfNoDb(t)) return;
  // Regression guard for P1-031: before the guard resolved sessions
  // against the database, anything correctly signed was accepted, which
  // is why P1-030's revocation could not stop live traffic.
  const res = await request(app!.getHttpServer())
    .get(`/api/v1/task-assignments/${randomUUID()}`)
    .set("Authorization", `Bearer ${randomUUID()}`);
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, "INVALID_SESSION");
});

test("full vertical slice: create family -> add child -> template -> assign -> start -> submit -> approve grants reward", async (t) => {
  if (skipIfNoDb(t)) return;
  const server = app!.getHttpServer();
  // A real account with a real session, exactly as a client would have.
  const parent = await createRealParentSession();
  const ownerId = parent.parentId;
  const ownerToken = parent.sessionId;
  const authed = (req: request.Test) => req.set("Authorization", `Bearer ${ownerToken}`);
  const familyId = parent.familyId;

  const childRes = await authed(request(server).post(`/api/v1/families/${familyId}/children`)).send({
    displayName: "Аня",
    birthYear: 2016,
  });
  assert.equal(childRes.status, 201);
  // openapi.yaml's 201 for this operation is a ChildProfile, not a
  // Family -- asserting the actual shape, not just the status, is what
  // caught the controller returning the wrong aggregate.
  assert.equal(childRes.body.familyId, familyId);
  assert.equal(childRes.body.displayName, "Аня");
  assert.equal(childRes.body.birthYear, 2016);
  assert.ok(childRes.body.childId, "response must be a ChildProfile carrying childId");
  assert.equal(childRes.body.children, undefined, "must not be the whole Family aggregate");
  const childId: string = childRes.body.childId;

  const templateRes = await authed(request(server).post(`/api/v1/families/${familyId}/task-templates`)).send({
    title: "Убрать в комнате",
    verificationStrategy: "PARENT_APPROVAL",
    rewardXp: 15,
    rewardCoins: 5,
  });
  assert.equal(templateRes.status, 201);
  assert.equal(templateRes.body.status, "DRAFT");
  const templateId = templateRes.body.taskTemplateId;

  const listRes = await authed(request(server).get(`/api/v1/families/${familyId}/task-templates`));
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.items.length, 1);
  assert.equal(listRes.body.page_info.has_next_page, false);

  // publishTaskTemplate (P1-028, from DISC-P1-026-1) -- without it the
  // chain below is unreachable, since assignTask requires ACTIVE.
  const publishRes = await authed(request(server).post(`/api/v1/task-templates/${templateId}/publish`)).set(
    "Idempotency-Key",
    `publish-${templateId}`,
  );
  assert.equal(publishRes.status, 200, "openapi.yaml declares 200 for publishTaskTemplate");
  assert.equal(publishRes.body.status, "ACTIVE");

  const assignRes = await authed(request(server).post(`/api/v1/task-templates/${templateId}/assignments`)).send({
    assignedToChildId: childId,
  });
  assert.equal(assignRes.status, 201);
  assert.equal(assignRes.body.status, "ASSIGNED");
  const assignmentId = assignRes.body.taskAssignmentId;

  // The child acts from here -- a real parent-provisioned session, not
  // the parent's own, and not something the child could mint.
  const childToken = await createRealChildSession(familyId, childId, ownerId);
  const asChild = (req: request.Test) => req.set("Authorization", `Bearer ${childToken}`);

  const startRes = await asChild(request(server).post(`/api/v1/task-assignments/${assignmentId}/start`)).set(
    "Idempotency-Key",
    `start-${assignmentId}`,
  );
  assert.equal(startRes.status, 200, "openapi.yaml declares 200 for startTaskAssignment");
  assert.equal(startRes.body.status, "IN_PROGRESS");

  const submitRes = await asChild(request(server).post(`/api/v1/task-assignments/${assignmentId}/completions`))
    .set("Idempotency-Key", `submit-${assignmentId}`)
    .send({ selfReportNote: "Готово!" });
  assert.equal(submitRes.status, 201);
  assert.equal(submitRes.body.childId, childId);

  const approveRes = await authed(request(server).post(`/api/v1/task-assignments/${assignmentId}/approve`)).set(
    "Idempotency-Key",
    `approve-${assignmentId}`,
  );
  assert.equal(approveRes.status, 200, "openapi.yaml declares 200 for approveTaskCompletion");
  assert.equal(approveRes.body.status, "COMPLETED");

  // The whole point of the chain: approval actually granted the reward.
  const ledgerRes = await authed(request(server).get(`/api/v1/children/${childId}/reward-ledger`));
  assert.equal(ledgerRes.status, 200);
  const kinds = ledgerRes.body.items.map((e: { kind: string }) => e.kind).sort();
  assert.deepEqual(kinds, ["COINS", "XP"]);
  const xp = ledgerRes.body.items.find((e: { kind: string }) => e.kind === "XP");
  assert.equal(xp.amount, 15);
  assert.equal(xp.reason, "TASK_COMPLETION");

  // Replaying approve must not grant the reward twice.
  const approveAgain = await authed(request(server).post(`/api/v1/task-assignments/${assignmentId}/approve`)).set(
    "Idempotency-Key",
    `approve-${assignmentId}`,
  );
  assert.equal(approveAgain.status, 200);
  const ledgerAfterReplay = await authed(request(server).get(`/api/v1/children/${childId}/reward-ledger`));
  assert.equal(ledgerAfterReplay.body.items.length, 2, "replayed approval must not double-post the ledger");

  const todayRes = await request(server).get(`/api/v1/child/today?childId=${childId}`).set("Authorization", `Bearer ${childToken}`);
  assert.equal(todayRes.status, 200);
  assert.equal(todayRes.body.childId, childId);
  assert.equal(todayRes.body.assignments.length, 1);
  assert.equal(todayRes.body.assignments[0].status, "COMPLETED");
});

test("publishTaskTemplate is idempotent: publishing an already-ACTIVE template returns it unchanged", async (t) => {
  if (skipIfNoDb(t)) return;
  const server = app!.getHttpServer();
  const parent = await createRealParentSession();
  const authed = (req: request.Test) => req.set("Authorization", `Bearer ${parent.sessionId}`);
  const familyId = parent.familyId;
  const templateRes = await authed(request(server).post(`/api/v1/families/${familyId}/task-templates`)).send({
    title: "Полить цветы",
    verificationStrategy: "MANUAL_SELF",
    rewardXp: 5,
    rewardCoins: 1,
  });
  const templateId = templateRes.body.taskTemplateId;

  const first = await authed(request(server).post(`/api/v1/task-templates/${templateId}/publish`)).set("Idempotency-Key", "k1");
  assert.equal(first.body.status, "ACTIVE");
  const second = await authed(request(server).post(`/api/v1/task-templates/${templateId}/publish`)).set("Idempotency-Key", "k1");
  assert.equal(second.body.status, "ACTIVE");
  assert.equal(second.body.version, first.body.version, "a replayed publish must not bump the version");
});

test("GET /api/v1/task-assignments/:id returns 404 for an unknown id", async (t) => {
  if (skipIfNoDb(t)) return;
  const parent = await createRealParentSession();
  const res = await request(app!.getHttpServer())
    .get(`/api/v1/task-assignments/${randomUUID()}`)
    .set("Authorization", `Bearer ${parent.sessionId}`);
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, "NOT_FOUND");
});
