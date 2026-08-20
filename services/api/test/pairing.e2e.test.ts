/**
 * Child device pairing (P1-036), closing DISC-P1-032-1.
 *
 * The properties under test are the ones that make handing a code to a
 * child safe at all: it is not the session, it works once, it dies
 * quickly, and it cannot cross a family boundary. Each is asserted rather
 * than assumed, because every one of them is easy to lose in a later
 * "small" change.
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
    const check = await getPool().query("SELECT to_regclass('public.child_pairing_codes') AS exists");
    dbAvailable = Boolean(check.rows[0]?.exists);
  } catch {
    dbAvailable = false;
  }
  if (!dbAvailable) {
    console.log("\n[pairing.e2e.test.ts] DATABASE_URL unreachable or unmigrated. Skipping.");
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

const PASSWORD = "pairing-pw-12345";
const email = () => `pair-${randomUUID()}@example.test`;

/** A signed-in parent with a family and one child, all over HTTP. */
async function parentWithChild() {
  const server = app!.getHttpServer();
  const parentEmail = email();
  const signUp = await request(server).post("/api/v1/auth/sign-up").send({ email: parentEmail, password: PASSWORD });
  await request(server).post("/api/v1/auth/consent").send({ accountId: signUp.body.accountId });
  const signIn = await request(server).post("/api/v1/auth/sign-in").send({ email: parentEmail, password: PASSWORD });
  const auth = { Authorization: `Bearer ${signIn.body.sessionId}` };
  const family = await request(server).post("/api/v1/families").set(auth).send({});
  const child = await request(server)
    .post(`/api/v1/families/${family.body.familyId}/children`)
    .set(auth)
    .send({ displayName: "Аня", birthYear: new Date().getFullYear() - 8 });
  return { auth, familyId: family.body.familyId as string, childId: child.body.childId as string };
}

test("a parent issues a code and the child device redeems it for a working session", async (t) => {
  if (skipIfNoDb(t)) return;
  const server = app!.getHttpServer();
  const { auth, childId } = await parentWithChild();

  const issued = await request(server).post("/api/v1/auth/child-pairing-codes").set(auth).send({ childId });
  assert.equal(issued.status, 200);
  assert.ok(issued.body.code, "the parent is shown a code");
  assert.ok(issued.body.expiresAt);

  // Redemption is unauthenticated by necessity: the child device has no
  // session yet, which is the whole problem being solved.
  const redeemed = await request(server).post("/api/v1/auth/child-pairing-codes/redeem").send({ code: issued.body.code });
  assert.equal(redeemed.status, 200);
  assert.equal(redeemed.body.role, "child");

  const today = await request(server)
    .get(`/api/v1/child/today?childId=${childId}`)
    .set("Authorization", `Bearer ${redeemed.body.sessionId}`);
  assert.equal(today.status, 200, "the paired session must actually work");
  assert.equal(today.body.childId, childId);
});

test("the pairing code is never the session id it yields", async (t) => {
  if (skipIfNoDb(t)) return;
  const server = app!.getHttpServer();
  const { auth, childId } = await parentWithChild();

  const issued = await request(server).post("/api/v1/auth/child-pairing-codes").set(auth).send({ childId });
  const redeemed = await request(server).post("/api/v1/auth/child-pairing-codes/redeem").send({ code: issued.body.code });

  // DISC-P1-032-1's core constraint. A session id is a bearer credential;
  // the thing a parent reads aloud must not be one.
  assert.notEqual(issued.body.code, redeemed.body.sessionId);
  assert.ok(issued.body.code.length < 20, "a code a parent reads aloud must be short");
});

test("a code works exactly once", async (t) => {
  if (skipIfNoDb(t)) return;
  const server = app!.getHttpServer();
  const { auth, childId } = await parentWithChild();

  const issued = await request(server).post("/api/v1/auth/child-pairing-codes").set(auth).send({ childId });
  const first = await request(server).post("/api/v1/auth/child-pairing-codes/redeem").send({ code: issued.body.code });
  assert.equal(first.status, 200);

  const second = await request(server).post("/api/v1/auth/child-pairing-codes/redeem").send({ code: issued.body.code });
  assert.equal(second.status, 403, "a spent code must not pair a second device");
});

test("re-issuing invalidates the previous outstanding code", async (t) => {
  if (skipIfNoDb(t)) return;
  const server = app!.getHttpServer();
  const { auth, childId } = await parentWithChild();

  const first = await request(server).post("/api/v1/auth/child-pairing-codes").set(auth).send({ childId });
  const second = await request(server).post("/api/v1/auth/child-pairing-codes").set(auth).send({ childId });
  assert.notEqual(first.body.code, second.body.code);

  // A parent asking for a new code has usually lost track of the old one.
  // Two live codes is two chances for the wrong device to pair.
  const stale = await request(server).post("/api/v1/auth/child-pairing-codes/redeem").send({ code: first.body.code });
  assert.equal(stale.status, 403, "the superseded code must be dead");

  const current = await request(server).post("/api/v1/auth/child-pairing-codes/redeem").send({ code: second.body.code });
  assert.equal(current.status, 200);
});

test("an unknown code fails the same way a spent one does", async (t) => {
  if (skipIfNoDb(t)) return;
  const res = await request(app!.getHttpServer())
    .post("/api/v1/auth/child-pairing-codes/redeem")
    .send({ code: "99999999" });
  assert.equal(res.status, 403);
  // A distinct "already used" message would confirm a guessed code was
  // real, which is the one thing a guesser wants to learn.
  assert.equal(res.body.error.code, "PAIRING_CODE_INVALID");
});

test("a parent cannot issue a code for another family's child", async (t) => {
  if (skipIfNoDb(t)) return;
  const server = app!.getHttpServer();
  const a = await parentWithChild();
  const b = await parentWithChild();

  const attempt = await request(server).post("/api/v1/auth/child-pairing-codes").set(a.auth).send({ childId: b.childId });
  assert.equal(attempt.status, 403, "pairing must not cross a family boundary");
});

test("an expired code cannot be redeemed", async (t) => {
  if (skipIfNoDb(t)) return;
  const server = app!.getHttpServer();
  const { auth, childId } = await parentWithChild();

  const issued = await request(server).post("/api/v1/auth/child-pairing-codes").set(auth).send({ childId });
  // Expire it directly rather than waiting out the TTL -- the behaviour
  // under test is the expiry check, not the clock.
  await getPool().query("UPDATE child_pairing_codes SET expires_at = $1 WHERE redeemed_at IS NULL AND child_id = $2", [
    new Date(Date.now() - 1000).toISOString(),
    childId,
  ]);

  const res = await request(server).post("/api/v1/auth/child-pairing-codes/redeem").send({ code: issued.body.code });
  assert.equal(res.status, 403);
});

test("the plaintext code is never stored", async (t) => {
  if (skipIfNoDb(t)) return;
  const server = app!.getHttpServer();
  const { auth, childId } = await parentWithChild();
  const issued = await request(server).post("/api/v1/auth/child-pairing-codes").set(auth).send({ childId });

  const { rows } = await getPool().query("SELECT code_hash FROM child_pairing_codes WHERE child_id = $1", [childId]);
  assert.ok(rows.length > 0);
  for (const row of rows) {
    // A read of this table must not let someone pair a device -- the same
    // reasoning as credentials, applied to a short-lived one.
    assert.notEqual(row.code_hash, issued.body.code);
  }
});
