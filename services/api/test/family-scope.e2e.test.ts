/**
 * Family-scope authorization (P1-037, from DISC-P1-004-2).
 *
 * Every one of these endpoints described itself as family-scoped and
 * none of them enforced it: an authenticated session could read or act
 * on any family's data by supplying its id. These tests are written from
 * the attacker's side — a real second family, signed in for real,
 * reaching for the first family's resources over HTTP.
 *
 * They are deliberately one test per endpoint rather than a loop. When
 * one regresses, the failure should name which door was left open.
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
    console.log("\n[family-scope.e2e.test.ts] DATABASE_URL unreachable or unmigrated. Skipping.");
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

const PASSWORD = `scope-pw-${randomUUID()}`;
const email = () => `fs-${randomUUID()}@example.test`;

interface Household {
  parent: { Authorization: string };
  child: { Authorization: string };
  familyId: string;
  childId: string;
  templateId: string;
  assignmentId: string;
}

/** A whole household with a template published and one task assigned. */
async function household(): Promise<Household> {
  const server = app!.getHttpServer();
  const parentEmail = email();
  const signUp = await request(server).post("/api/v1/auth/sign-up").send({ email: parentEmail, password: PASSWORD });
  await request(server).post("/api/v1/auth/consent").send({ accountId: signUp.body.accountId });
  const signIn = await request(server).post("/api/v1/auth/sign-in").send({ email: parentEmail, password: PASSWORD });
  const parent = { Authorization: `Bearer ${signIn.body.sessionId}` };

  const family = await request(server).post("/api/v1/families").set(parent).send({});
  const familyId = family.body.familyId as string;
  const childRes = await request(server)
    .post(`/api/v1/families/${familyId}/children`)
    .set(parent)
    .send({ displayName: "Аня", birthYear: new Date().getFullYear() - 8 });
  const childId = childRes.body.childId as string;
  const childSession = await request(server).post("/api/v1/auth/child-sessions").set(parent).send({ childId });

  const template = await request(server)
    .post(`/api/v1/families/${familyId}/task-templates`)
    .set(parent)
    .send({ title: "Убрать со стола", verificationStrategy: "PARENT_APPROVAL", rewardXp: 10, rewardCoins: 2 });
  const templateId = template.body.taskTemplateId as string;
  await request(server).post(`/api/v1/task-templates/${templateId}/publish`).set(parent);
  const assignment = await request(server)
    .post(`/api/v1/task-templates/${templateId}/assignments`)
    .set(parent)
    .send({ assignedToChildId: childId });

  return {
    parent,
    child: { Authorization: `Bearer ${childSession.body.sessionId}` },
    familyId,
    childId,
    templateId,
    assignmentId: assignment.body.taskAssignmentId as string,
  };
}

/** Every refusal is 403; a 404 would still confirm the id is real. */
function assertRefused(status: number, what: string) {
  assert.equal(status, 403, `${what} was not refused`);
}

test("a stranger cannot read another family", async (t) => {
  if (skipIfNoDb(t)) return;
  const server = app!.getHttpServer();
  const victim = await household();
  const attacker = await household();

  const probe = await request(server).get(`/api/v1/families/${victim.familyId}`).set(attacker.parent);
  // DISC-P1-004-2: this returned the whole family, children included.
  assertRefused(probe.status, "reading another family");
  assert.ok(!JSON.stringify(probe.body).includes("Аня"));
});

test("a stranger cannot list another family's task templates", async (t) => {
  if (skipIfNoDb(t)) return;
  const server = app!.getHttpServer();
  const victim = await household();
  const attacker = await household();

  const probe = await request(server)
    .get(`/api/v1/families/${victim.familyId}/task-templates`)
    .set(attacker.parent);
  assertRefused(probe.status, "listing another family's templates");
});

test("a stranger cannot create a task template in another family", async (t) => {
  if (skipIfNoDb(t)) return;
  const server = app!.getHttpServer();
  const victim = await household();
  const attacker = await household();

  const probe = await request(server)
    .post(`/api/v1/families/${victim.familyId}/task-templates`)
    .set(attacker.parent)
    .send({ title: "Чужое", verificationStrategy: "MANUAL_SELF", rewardXp: 1, rewardCoins: 0 });
  // Writing into someone else's family is worse than reading it: it puts
  // a task in front of a child whose parents never agreed to it.
  assertRefused(probe.status, "creating a template in another family");
});

test("a stranger cannot add a child to another family", async (t) => {
  if (skipIfNoDb(t)) return;
  const server = app!.getHttpServer();
  const victim = await household();
  const attacker = await household();

  const probe = await request(server)
    .post(`/api/v1/families/${victim.familyId}/children`)
    .set(attacker.parent)
    .send({ displayName: "Чужой", birthYear: 2018 });
  assertRefused(probe.status, "adding a child to another family");
});

test("a stranger cannot publish or assign another family's template", async (t) => {
  if (skipIfNoDb(t)) return;
  const server = app!.getHttpServer();
  const victim = await household();
  const attacker = await household();

  assertRefused(
    (await request(server).post(`/api/v1/task-templates/${victim.templateId}/publish`).set(attacker.parent)).status,
    "publishing another family's template",
  );
  assertRefused(
    (
      await request(server)
        .post(`/api/v1/task-templates/${victim.templateId}/assignments`)
        .set(attacker.parent)
        .send({ assignedToChildId: attacker.childId })
    ).status,
    "assigning another family's template",
  );
});

test("a parent cannot assign their own template to someone else's child", async (t) => {
  if (skipIfNoDb(t)) return;
  const server = app!.getHttpServer();
  const victim = await household();
  const attacker = await household();

  // Both ends need checking. Guarding only the template would let a
  // caller push a task onto a child in a family they have no part in.
  const probe = await request(server)
    .post(`/api/v1/task-templates/${attacker.templateId}/assignments`)
    .set(attacker.parent)
    .send({ assignedToChildId: victim.childId });
  assertRefused(probe.status, "assigning to another family's child");
});

test("a stranger cannot read, start or submit another family's assignment", async (t) => {
  if (skipIfNoDb(t)) return;
  const server = app!.getHttpServer();
  const victim = await household();
  const attacker = await household();

  const id = victim.assignmentId;
  assertRefused((await request(server).get(`/api/v1/task-assignments/${id}`).set(attacker.parent)).status, "reading");
  assertRefused(
    (await request(server).post(`/api/v1/task-assignments/${id}/start`).set(attacker.child)).status,
    "starting",
  );
  assertRefused(
    (await request(server).post(`/api/v1/task-assignments/${id}/completions`).set(attacker.child).send({ selfReportNote: "х" }))
      .status,
    "submitting a completion",
  );
});

test("a stranger cannot approve another family's task and collect the reward", async (t) => {
  if (skipIfNoDb(t)) return;
  const server = app!.getHttpServer();
  const victim = await household();
  const attacker = await household();

  const probe = await request(server)
    .post(`/api/v1/task-assignments/${victim.assignmentId}/approve`)
    .set(attacker.parent);
  assertRefused(probe.status, "approving another family's task");
});

test("a child cannot approve their own work", async (t) => {
  if (skipIfNoDb(t)) return;
  const server = app!.getHttpServer();
  const h = await household();

  await request(server).post(`/api/v1/task-assignments/${h.assignmentId}/start`).set(h.child);
  await request(server)
    .post(`/api/v1/task-assignments/${h.assignmentId}/completions`)
    .set(h.child)
    .send({ selfReportNote: "готово" });

  const probe = await request(server).post(`/api/v1/task-assignments/${h.assignmentId}/approve`).set(h.child);
  // Nothing checked this before: a child session could approve its own
  // assignment and be granted the reward. The approval step existed but
  // decided nothing.
  assertRefused(probe.status, "a child approving their own task");

  const ledger = await request(server).get(`/api/v1/children/${h.childId}/reward-ledger`).set(h.child);
  assert.equal(ledger.body.items.length, 0, "no reward may have been granted");
});

test("a child cannot reject, and a parent still can", async (t) => {
  if (skipIfNoDb(t)) return;
  const server = app!.getHttpServer();
  const h = await household();

  await request(server).post(`/api/v1/task-assignments/${h.assignmentId}/start`).set(h.child);
  await request(server)
    .post(`/api/v1/task-assignments/${h.assignmentId}/completions`)
    .set(h.child)
    .send({ selfReportNote: "готово" });

  assertRefused(
    (await request(server).post(`/api/v1/task-assignments/${h.assignmentId}/reject`).set(h.child).send({ comment: "н" }))
      .status,
    "a child rejecting",
  );
  const byParent = await request(server)
    .post(`/api/v1/task-assignments/${h.assignmentId}/reject`)
    .set(h.parent)
    .send({ comment: "ещё раз" });
  assert.equal(byParent.status, 200, "the guard must not break the legitimate path");
});

test("a stranger cannot read another child's reward ledger", async (t) => {
  if (skipIfNoDb(t)) return;
  const server = app!.getHttpServer();
  const victim = await household();
  const attacker = await household();

  assertRefused(
    (await request(server).get(`/api/v1/children/${victim.childId}/reward-ledger`).set(attacker.parent)).status,
    "a parent reading another family's ledger",
  );
  assertRefused(
    (await request(server).get(`/api/v1/children/${victim.childId}/reward-ledger`).set(attacker.child)).status,
    "a child reading another child's ledger",
  );
});

test("the whole legitimate journey still works end to end", async (t) => {
  if (skipIfNoDb(t)) return;
  const server = app!.getHttpServer();
  const h = await household();

  // A guard that refuses everything would pass every test above. This is
  // the one that says the doors still open for the people who live here.
  assert.equal((await request(server).get(`/api/v1/families/${h.familyId}`).set(h.parent)).status, 200);
  assert.equal((await request(server).post(`/api/v1/task-assignments/${h.assignmentId}/start`).set(h.child)).status, 200);
  assert.equal(
    (
      await request(server)
        .post(`/api/v1/task-assignments/${h.assignmentId}/completions`)
        .set(h.child)
        .send({ selfReportNote: "готово" })
    ).status,
    201,
  );
  assert.equal((await request(server).post(`/api/v1/task-assignments/${h.assignmentId}/approve`).set(h.parent)).status, 200);

  const ledger = await request(server).get(`/api/v1/children/${h.childId}/reward-ledger`).set(h.child);
  assert.equal(ledger.status, 200);
  assert.ok(ledger.body.items.length > 0, "the approved task must still have paid out");
});

test("a bootstrap session reaches nothing family-scoped", async (t) => {
  if (skipIfNoDb(t)) return;
  const server = app!.getHttpServer();
  const victim = await household();
  const parentEmail = email();
  const signUp = await request(server).post("/api/v1/auth/sign-up").send({ email: parentEmail, password: PASSWORD });
  await request(server).post("/api/v1/auth/consent").send({ accountId: signUp.body.accountId });
  const signIn = await request(server).post("/api/v1/auth/sign-in").send({ email: parentEmail, password: PASSWORD });
  const bootstrap = { Authorization: `Bearer ${signIn.body.sessionId}` };

  // A session with no family may only create one (ADR-0006 constraint 3).
  assertRefused((await request(server).get(`/api/v1/families/${victim.familyId}`).set(bootstrap)).status, "bootstrap read");
  assertRefused(
    (await request(server).get(`/api/v1/task-assignments/${victim.assignmentId}`).set(bootstrap)).status,
    "bootstrap assignment read",
  );
});

test("an unknown id is refused the same way as another family's", async (t) => {
  if (skipIfNoDb(t)) return;
  const server = app!.getHttpServer();
  const h = await household();

  // Distinguishing "no such thing" from "not yours" would turn every one
  // of these endpoints into an oracle for which ids are real.
  assertRefused((await request(server).get(`/api/v1/families/${randomUUID()}`).set(h.parent)).status, "unknown family");
  assertRefused(
    (await request(server).get(`/api/v1/task-assignments/${randomUUID()}`).set(h.parent)).status,
    "unknown assignment",
  );
  assertRefused(
    (await request(server).post(`/api/v1/task-templates/${randomUUID()}/publish`).set(h.parent)).status,
    "unknown template",
  );
});
