/**
 * Session introspection (P1-003, DISC-P1-003-1).
 *
 * A browser surface cannot read its own session cookie, so this endpoint
 * is how it learns what that session is scoped to. Two properties make it
 * safe to have at all, and both are asserted here rather than assumed:
 * it never hands the bearer value back to client script, and it reports
 * the scope the server actually enforces rather than a client's claim.
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
    console.log("\n[session-scope.e2e.test.ts] DATABASE_URL unreachable or unmigrated. Skipping.");
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

// Generated per run rather than a literal. Nothing here needs a fixed
// value, and a hardcoded one is indistinguishable from a real secret to
// a scanner -- which is a fair complaint, not a false positive to
// silence.
const PASSWORD = `scope-pw-${randomUUID()}`;
const email = () => `scope-${randomUUID()}@example.test`;

async function signedInParent() {
  const server = app!.getHttpServer();
  const parentEmail = email();
  const signUp = await request(server).post("/api/v1/auth/sign-up").send({ email: parentEmail, password: PASSWORD });
  await request(server).post("/api/v1/auth/consent").send({ accountId: signUp.body.accountId });
  const signIn = await request(server).post("/api/v1/auth/sign-in").send({ email: parentEmail, password: PASSWORD });
  return { server, sessionId: signIn.body.sessionId as string, parentId: signUp.body.parentId as string };
}

test("a bootstrap session reports no family, which is how a surface knows to send the parent to setup", async (t) => {
  if (skipIfNoDb(t)) return;
  const { server, sessionId, parentId } = await signedInParent();

  const scope = await request(server).get("/api/v1/auth/session").set("Authorization", `Bearer ${sessionId}`);
  assert.equal(scope.status, 200);
  assert.equal(scope.body.role, "parent");
  assert.equal(scope.body.actorId, parentId);
  assert.equal(scope.body.familyId, undefined, "a bootstrap session belongs to no family (DISC-P1-031-1)");
});

test("after creating a family the same session reports that family", async (t) => {
  if (skipIfNoDb(t)) return;
  const { server, sessionId } = await signedInParent();
  const auth = { Authorization: `Bearer ${sessionId}` };

  const family = await request(server).post("/api/v1/families").set(auth).send({});
  assert.equal(family.status, 201);

  const scope = await request(server).get("/api/v1/auth/session").set(auth);
  assert.equal(scope.status, 200);
  // The session is scoped in the same transaction that creates the
  // family, so a parent never has to sign out mid-onboarding.
  assert.equal(scope.body.familyId, family.body.familyId);
});

test("the session id is never returned", async (t) => {
  if (skipIfNoDb(t)) return;
  const { server, sessionId } = await signedInParent();

  const scope = await request(server).get("/api/v1/auth/session").set("Authorization", `Bearer ${sessionId}`);
  // The whole reason the web tier keeps this value in an httpOnly cookie
  // is that client script must not be able to obtain it. An endpoint
  // that echoes it back would quietly undo that.
  assert.ok(!JSON.stringify(scope.body).includes(sessionId), "the bearer value must not reach client script");
});

test("a child session reports the child role, not the parent's", async (t) => {
  if (skipIfNoDb(t)) return;
  const { server, sessionId } = await signedInParent();
  const auth = { Authorization: `Bearer ${sessionId}` };
  const family = await request(server).post("/api/v1/families").set(auth).send({});
  const child = await request(server)
    .post(`/api/v1/families/${family.body.familyId}/children`)
    .set(auth)
    .send({ displayName: "Аня", birthYear: new Date().getFullYear() - 8 });
  const childSession = await request(server)
    .post("/api/v1/auth/child-sessions")
    .set(auth)
    .send({ childId: child.body.childId });

  const scope = await request(server)
    .get("/api/v1/auth/session")
    .set("Authorization", `Bearer ${childSession.body.sessionId}`);
  assert.equal(scope.status, 200);
  assert.equal(scope.body.role, "child");
  assert.equal(scope.body.actorId, child.body.childId);
  assert.equal(scope.body.familyId, family.body.familyId);
});

test("an absent or unknown session is refused rather than described", async (t) => {
  if (skipIfNoDb(t)) return;
  const server = app!.getHttpServer();

  assert.equal((await request(server).get("/api/v1/auth/session")).status, 401);
  assert.equal(
    (await request(server).get("/api/v1/auth/session").set("Authorization", `Bearer ${randomUUID()}`)).status,
    401,
  );
});

test("a revoked session stops describing itself immediately", async (t) => {
  if (skipIfNoDb(t)) return;
  const { server, sessionId } = await signedInParent();
  const auth = { Authorization: `Bearer ${sessionId}` };

  assert.equal((await request(server).get("/api/v1/auth/session").set(auth)).status, 200);
  await request(server).post("/api/v1/auth/sign-out").set(auth);
  // ADR-0006 D2 chose server-side session records precisely so that
  // revocation takes effect at once; this is that promise, observed.
  assert.equal((await request(server).get("/api/v1/auth/session").set(auth)).status, 401);
});
