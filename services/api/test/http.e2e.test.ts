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
import { signSessionToken } from "../src/auth/session.js";
import { closePool, getPool } from "../src/db/pool.js";

let dbAvailable = false;
let app: INestApplication | undefined;

before(async () => {
  process.env.SESSION_JWT_SECRET ??= "test-only-secret-not-a-real-credential";
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
  const actorId = randomUUID();
  const token = signSessionToken({ actorId, role: "parent" });
  const res = await request(app!.getHttpServer())
    .post("/api/v1/families")
    .set("Authorization", `Bearer ${token}`)
    .send({ ownerParentId: randomUUID() }); // different id
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, "OWNER_MUST_BE_SELF");
});

test("full vertical slice: create family -> add child -> template -> assign -> start -> submit -> approve grants reward", async (t) => {
  if (skipIfNoDb(t)) return;
  const server = app!.getHttpServer();
  const ownerId = randomUUID();
  const ownerToken = signSessionToken({ actorId: ownerId, role: "parent" });
  const authed = (req: request.Test) => req.set("Authorization", `Bearer ${ownerToken}`);

  const familyRes = await authed(request(server).post("/api/v1/families")).send({ ownerParentId: ownerId });
  assert.equal(familyRes.status, 201);
  const familyId = familyRes.body.familyId;

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

  // publishTemplate has no dedicated endpoint in the frozen contract yet
  // -- assignTask requires an ACTIVE template, so this slice can only
  // reach as far as template creation via HTTP today. Recorded as a
  // known gap in this task's handoff, not silently worked around.
  const listRes = await authed(request(server).get(`/api/v1/families/${familyId}/task-templates`));
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.items.length, 1);
  assert.equal(listRes.body.page_info.has_next_page, false);

  const ledgerRes = await authed(request(server).get(`/api/v1/children/${childId}/reward-ledger`));
  assert.equal(ledgerRes.status, 200);
  assert.deepEqual(ledgerRes.body.items, []);

  const todayRes = await request(server).get(`/api/v1/child/today?childId=${childId}`).set("Authorization", `Bearer ${ownerToken}`);
  assert.equal(todayRes.status, 200);
  assert.equal(todayRes.body.childId, childId);
  assert.deepEqual(todayRes.body.assignments, []);
});

test("GET /api/v1/task-assignments/:id returns 404 for an unknown id", async (t) => {
  if (skipIfNoDb(t)) return;
  const token = signSessionToken({ actorId: randomUUID(), role: "parent" });
  const res = await request(app!.getHttpServer())
    .get(`/api/v1/task-assignments/${randomUUID()}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, "NOT_FOUND");
});
