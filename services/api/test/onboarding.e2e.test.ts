/**
 * Onboarding end-to-end (P1-032).
 *
 * The gap this closes, recorded as DISC-P1-010-1: every other suite
 * obtains a session through a helper that calls the repositories
 * directly. None of them proves a *person* could get in. This one runs
 * the whole entry path over HTTP only -- sign up, accept consent, sign
 * in, create a family, add a child, open the child's access, and then
 * act as that child -- with no repository calls and nothing minted.
 *
 * If this passes, a human with a browser can reach the product. That was
 * not true before this task.
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
    const check = await getPool().query("SELECT to_regclass('public.sessions') AS exists");
    dbAvailable = Boolean(check.rows[0]?.exists);
  } catch {
    dbAvailable = false;
  }
  if (!dbAvailable) {
    console.log("\n[onboarding.e2e.test.ts] DATABASE_URL unreachable or unmigrated. Skipping.");
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

const PASSWORD = "onboarding-pw-1234";
const email = () => `onboard-${randomUUID()}@example.test`;

test("a new person can sign up, consent, sign in, set up a family and open child access -- over HTTP only", async (t) => {
  if (skipIfNoDb(t)) return;
  const server = app!.getHttpServer();
  const parentEmail = email();

  // --- sign up -------------------------------------------------------
  const signUp = await request(server).post("/api/v1/auth/sign-up").send({ email: parentEmail, password: PASSWORD });
  assert.equal(signUp.status, 201);
  assert.equal(signUp.body.status, "PENDING_VERIFICATION", "a new account must not start usable");
  const accountId: string = signUp.body.accountId;

  // --- consent -------------------------------------------------------
  const consent = await request(server).post("/api/v1/auth/consent").send({ accountId });
  assert.equal(consent.status, 200);
  assert.equal(consent.body.status, "ACTIVE");

  // --- sign in with no family: a bootstrap session -------------------
  const bootstrap = await request(server).post("/api/v1/auth/sign-in").send({ email: parentEmail, password: PASSWORD });
  assert.equal(bootstrap.status, 200);
  assert.ok(bootstrap.body.sessionId, "sign-in must return an opaque session id");
  assert.equal(
    bootstrap.body.familyId,
    undefined,
    "a parent with no family gets a bootstrap session -- the client uses the absent familyId to route to setup",
  );
  const bootstrapAuth = { Authorization: `Bearer ${bootstrap.body.sessionId}` };

  // --- create the family, which is all a bootstrap session may do ----
  const family = await request(server).post("/api/v1/families").set(bootstrapAuth).send({});
  assert.equal(family.status, 201);
  const familyId: string = family.body.familyId;

  // --- add a child ---------------------------------------------------
  const child = await request(server)
    .post(`/api/v1/families/${familyId}/children`)
    .set(bootstrapAuth)
    .send({ displayName: "Аня", birthYear: new Date().getFullYear() - 8 });
  assert.equal(child.status, 201);
  const childId: string = child.body.childId;

  // --- open the child's access ---------------------------------------
  const childSession = await request(server).post("/api/v1/auth/child-sessions").set(bootstrapAuth).send({ childId });
  assert.equal(childSession.status, 200);
  assert.equal(childSession.body.role, "child");
  assert.ok(childSession.body.sessionId);

  // --- and the child can actually use it ------------------------------
  const today = await request(server)
    .get(`/api/v1/child/today?childId=${childId}`)
    .set("Authorization", `Bearer ${childSession.body.sessionId}`);
  assert.equal(today.status, 200, "the provisioned child session must actually work");
  assert.equal(today.body.childId, childId);
});

test("a bootstrap session cannot act on someone else's family", async (t) => {
  if (skipIfNoDb(t)) return;
  const server = app!.getHttpServer();

  // A stranger who has signed up but set nothing up.
  const strangerEmail = email();
  const signUp = await request(server).post("/api/v1/auth/sign-up").send({ email: strangerEmail, password: PASSWORD });
  await request(server).post("/api/v1/auth/consent").send({ accountId: signUp.body.accountId });
  const stranger = await request(server).post("/api/v1/auth/sign-in").send({ email: strangerEmail, password: PASSWORD });

  // A real family belonging to someone else.
  const ownerEmail = email();
  const ownerSignUp = await request(server).post("/api/v1/auth/sign-up").send({ email: ownerEmail, password: PASSWORD });
  await request(server).post("/api/v1/auth/consent").send({ accountId: ownerSignUp.body.accountId });
  const owner = await request(server).post("/api/v1/auth/sign-in").send({ email: ownerEmail, password: PASSWORD });
  const family = await request(server)
    .post("/api/v1/families")
    .set("Authorization", `Bearer ${owner.body.sessionId}`)
    .send({});

  // The bootstrap session is narrow by construction: it carries no
  // familyId, so every family-scoped check fails closed for it. Nothing
  // had to be relaxed to make onboarding work.
  const attempt = await request(server)
    .post(`/api/v1/families/${family.body.familyId}/task-templates`)
    .set("Authorization", `Bearer ${stranger.body.sessionId}`)
    .send({ title: "Чужое", verificationStrategy: "MANUAL_SELF", rewardXp: 1, rewardCoins: 1 });
  assert.equal(attempt.status, 403, "a stranger must not be able to act on a family they do not belong to");
});

test("signing out revokes the session immediately", async (t) => {
  if (skipIfNoDb(t)) return;
  const server = app!.getHttpServer();
  const parentEmail = email();
  const signUp = await request(server).post("/api/v1/auth/sign-up").send({ email: parentEmail, password: PASSWORD });
  await request(server).post("/api/v1/auth/consent").send({ accountId: signUp.body.accountId });
  const session = await request(server).post("/api/v1/auth/sign-in").send({ email: parentEmail, password: PASSWORD });
  const auth = { Authorization: `Bearer ${session.body.sessionId}` };

  const family = await request(server).post("/api/v1/families").set(auth).send({});
  assert.equal(family.status, 201, "precondition: the session works");

  const signOut = await request(server).post("/api/v1/auth/sign-out").set(auth).send();
  assert.equal(signOut.status, 204);

  // The session record is revoked, so the same bearer value stops
  // working at once -- not when it would have expired.
  const after = await request(server).get(`/api/v1/families/${family.body.familyId}`).set(auth);
  assert.equal(after.status, 401);
  assert.equal(after.body.error.code, "INVALID_SESSION");
});

test("a wrong password never yields a session, and says nothing about the account", async (t) => {
  if (skipIfNoDb(t)) return;
  const server = app!.getHttpServer();
  const parentEmail = email();
  const signUp = await request(server).post("/api/v1/auth/sign-up").send({ email: parentEmail, password: PASSWORD });
  await request(server).post("/api/v1/auth/consent").send({ accountId: signUp.body.accountId });

  const wrong = await request(server).post("/api/v1/auth/sign-in").send({ email: parentEmail, password: "not-the-password" });
  const unknown = await request(server).post("/api/v1/auth/sign-in").send({ email: email(), password: PASSWORD });

  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  // Identical responses: anything that distinguished them would let an
  // attacker discover which addresses are registered.
  assert.deepEqual(wrong.body, unknown.body);
});

test("sign-up refuses a short password", async (t) => {
  if (skipIfNoDb(t)) return;
  const res = await request(app!.getHttpServer()).post("/api/v1/auth/sign-up").send({ email: email(), password: "short" });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "PASSWORD_TOO_SHORT");
});

test("creating a family scopes the caller's bootstrap session to it, with no re-sign-in", async (t) => {
  if (skipIfNoDb(t)) return;
  const server = app!.getHttpServer();
  const parentEmail = email();
  const signUp = await request(server).post("/api/v1/auth/sign-up").send({ email: parentEmail, password: PASSWORD });
  await request(server).post("/api/v1/auth/consent").send({ accountId: signUp.body.accountId });
  const bootstrap = await request(server).post("/api/v1/auth/sign-in").send({ email: parentEmail, password: PASSWORD });
  assert.equal(bootstrap.body.familyId, undefined, "precondition: the session starts unscoped");
  const auth = { Authorization: `Bearer ${bootstrap.body.sessionId}` };

  const family = await request(server).post("/api/v1/families").set(auth).send({});
  assert.equal(family.status, 201);

  // The same bearer value must now work for a family-scoped operation.
  // Before this was fixed, the parent had to sign out and back in to
  // continue setting up -- signing out mid-onboarding to continue
  // onboarding is not a real flow, and the test that caught it is this
  // one's sibling above.
  const child = await request(server)
    .post(`/api/v1/families/${family.body.familyId}/children`)
    .set(auth)
    .send({ displayName: "Ваня", birthYear: new Date().getFullYear() - 6 });
  assert.equal(child.status, 201);

  const provisioned = await request(server)
    .post("/api/v1/auth/child-sessions")
    .set(auth)
    .send({ childId: child.body.childId });
  assert.equal(provisioned.status, 200, "the same session must be able to provision child access");
});

test("scoping a session never re-points one that already belongs to a family", async (t) => {
  if (skipIfNoDb(t)) return;
  const server = app!.getHttpServer();
  const parentEmail = email();
  const signUp = await request(server).post("/api/v1/auth/sign-up").send({ email: parentEmail, password: PASSWORD });
  await request(server).post("/api/v1/auth/consent").send({ accountId: signUp.body.accountId });
  const bootstrap = await request(server).post("/api/v1/auth/sign-in").send({ email: parentEmail, password: PASSWORD });
  const auth = { Authorization: `Bearer ${bootstrap.body.sessionId}` };

  const first = await request(server).post("/api/v1/families").set(auth).send({});
  const second = await request(server).post("/api/v1/families").set(auth).send({});
  assert.equal(second.status, 201, "creating a second family is allowed");

  // The session stays bound to the first family. Scoping only ever moves
  // a session out of the unscoped state, never between families -- so a
  // live session cannot be walked onto a different family's data.
  const childInSecond = await request(server)
    .post(`/api/v1/families/${second.body.familyId}/children`)
    .set(auth)
    .send({ displayName: "Мила", birthYear: new Date().getFullYear() - 7 });
  // Refused since P1-037, and this assertion used to say the opposite.
  // ADR-0006: authenticating proves who you are, not what you may act
  // on -- the session is scoped to the first family, so owning the
  // second one is not the same as currently acting in it. The parent
  // signs in again scoped to that family. That is also what the comment
  // directly above always said the rule was.
  assert.equal(childInSecond.status, 403, "a session scoped to one family does not act on another");

  // And the session still reports the first family, which is the
  // property this test is really about: creating a second family must
  // not walk a live session onto it.
  const scope = await request(server).get("/api/v1/auth/session").set(auth);
  assert.equal(scope.body.familyId, first.body.familyId);
  assert.notEqual(scope.body.familyId, second.body.familyId);

  // Acting in the first family still works, so the guard has not simply
  // frozen the session out of everything.
  const childInFirst = await request(server)
    .post(`/api/v1/families/${first.body.familyId}/children`)
    .set(auth)
    .send({ displayName: "Мила", birthYear: new Date().getFullYear() - 7 });
  assert.equal(childInFirst.status, 201);
});
