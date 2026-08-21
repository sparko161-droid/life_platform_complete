/**
 * Child today scoping (P1-004).
 *
 * openapi.yaml has always said this view is "scoped to the requesting
 * child's own assignments only". Until this task nothing enforced it:
 * childId arrived as a query parameter and was used verbatim, so any
 * child session could read any child's day by editing the URL. These
 * tests are the enforcement, stated as the properties a child-safety
 * review would ask for.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import "reflect-metadata";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { closePool, getPool } from "../src/db/pool.js";

let dbAvailable = false;
let app: INestApplication | undefined;

before(async () => {
  try {
    await getPool().query("SELECT 1");
    const check = await getPool().query("SELECT to_regclass('public.task_assignments') AS exists");
    dbAvailable = Boolean(check.rows[0]?.exists);
  } catch {
    dbAvailable = false;
  }
  if (!dbAvailable) {
    console.log("\n[child-today.e2e.test.ts] DATABASE_URL unreachable or unmigrated. Skipping.");
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

const PASSWORD = `today-pw-${randomUUID()}`;
const email = () => `today-${randomUUID()}@example.test`;

/** A family with one child, plus a session for each, all over HTTP. */
async function family(childName = "Аня") {
  const server = app!.getHttpServer();
  const parentEmail = email();
  const signUp = await request(server).post("/api/v1/auth/sign-up").send({ email: parentEmail, password: PASSWORD });
  await request(server).post("/api/v1/auth/consent").send({ accountId: signUp.body.accountId });
  const signIn = await request(server).post("/api/v1/auth/sign-in").send({ email: parentEmail, password: PASSWORD });
  const parent = { Authorization: `Bearer ${signIn.body.sessionId}` };
  const created = await request(server).post("/api/v1/families").set(parent).send({});
  const familyId = created.body.familyId as string;
  const child = await request(server)
    .post(`/api/v1/families/${familyId}/children`)
    .set(parent)
    .send({ displayName: childName, birthYear: new Date().getFullYear() - 8 });
  const childSession = await request(server)
    .post("/api/v1/auth/child-sessions")
    .set(parent)
    .send({ childId: child.body.childId });
  return {
    server,
    parent,
    familyId,
    childId: child.body.childId as string,
    child: { Authorization: `Bearer ${childSession.body.sessionId}` },
  };
}

/** Publishes a template and assigns it, returning the assignment. */
async function assignTask(f: Awaited<ReturnType<typeof family>>, title: string) {
  const template = await request(f.server)
    .post(`/api/v1/families/${f.familyId}/task-templates`)
    .set(f.parent)
    .send({ title, verificationStrategy: "PARENT_APPROVAL", rewardXp: 10, rewardCoins: 2 });
  await request(f.server).post(`/api/v1/task-templates/${template.body.taskTemplateId}/publish`).set(f.parent);
  const assigned = await request(f.server)
    .post(`/api/v1/task-templates/${template.body.taskTemplateId}/assignments`)
    .set(f.parent)
    .send({ assignedToChildId: f.childId });
  return assigned.body;
}

test("a child reads their own day without naming themselves", async (t) => {
  if (skipIfNoDb(t)) return;
  const f = await family();
  await assignTask(f, "Убрать со стола");

  // No childId in the query at all. The session decides.
  const today = await request(f.server).get("/api/v1/child/today").set(f.child);
  assert.equal(today.status, 200);
  assert.equal(today.body.childId, f.childId);
  assert.equal(today.body.assignments.length, 1);
});

test("a child cannot read another child's day by editing the URL", async (t) => {
  if (skipIfNoDb(t)) return;
  const mine = await family("Аня");
  const theirs = await family("Петя");
  await assignTask(theirs, "Чужое задание");

  const probe = await request(mine.server).get(`/api/v1/child/today?childId=${theirs.childId}`).set(mine.child);
  // Refused, not silently corrected: returning the caller's own day for
  // someone else's id would hide a client bug, and returning the
  // requested one is the vulnerability itself.
  assert.equal(probe.status, 403);
  assert.ok(!JSON.stringify(probe.body).includes("Чужое задание"));
});

test("a parent reads their own child's day", async (t) => {
  if (skipIfNoDb(t)) return;
  const f = await family();
  await assignTask(f, "Полить цветы");

  const today = await request(f.server).get(`/api/v1/child/today?childId=${f.childId}`).set(f.parent);
  assert.equal(today.status, 200);
  assert.equal(today.body.assignments.length, 1);
});

test("a parent cannot read a child from another family", async (t) => {
  if (skipIfNoDb(t)) return;
  const mine = await family();
  const theirs = await family();
  await assignTask(theirs, "Чужое задание");

  const probe = await request(mine.server).get(`/api/v1/child/today?childId=${theirs.childId}`).set(mine.parent);
  // "Family is the security boundary for child data"
  // (docs/product/actors-and-permissions.md).
  assert.equal(probe.status, 403);
});

test("an unknown child id fails the same way as another family's child", async (t) => {
  if (skipIfNoDb(t)) return;
  const f = await family();
  const probe = await request(f.server).get(`/api/v1/child/today?childId=${randomUUID()}`).set(f.parent);
  // Distinguishing "no such child" from "not yours" would turn this into
  // a probe for which child ids are real.
  assert.equal(probe.status, 403);
});

test("a parent must say which child", async (t) => {
  if (skipIfNoDb(t)) return;
  const f = await family();
  const probe = await request(f.server).get("/api/v1/child/today").set(f.parent);
  assert.equal(probe.status, 400);
});

test("a card carries the task title, so the screen never has to show a status", async (t) => {
  if (skipIfNoDb(t)) return;
  const f = await family();
  await assignTask(f, "Убрать со стола");

  const today = await request(f.server).get("/api/v1/child/today").set(f.child);
  const card = today.body.assignments[0];
  // A bare TaskAssignment has no title, so a screen built on one could
  // only show "ASSIGNED" -- an internal label docs/ux/ui-language.md
  // forbids putting in front of a child.
  assert.equal(card.title, "Убрать со стола");
  assert.equal(card.rewardXp, 10);
  assert.equal(card.rewardCoins, 2);
});

test("everHadTasks separates a first day from a quiet one", async (t) => {
  if (skipIfNoDb(t)) return;
  const f = await family();

  const before = await request(f.server).get("/api/v1/child/today").set(f.child);
  assert.equal(before.body.everHadTasks, false, "a child with no history is on their first day");

  await assignTask(f, "Убрать со стола");
  const after = await request(f.server).get("/api/v1/child/today").set(f.child);
  assert.equal(after.body.everHadTasks, true);
});

test("an unauthenticated caller gets nothing", async (t) => {
  if (skipIfNoDb(t)) return;
  const f = await family();
  assert.equal((await request(f.server).get(`/api/v1/child/today?childId=${f.childId}`)).status, 401);
});
