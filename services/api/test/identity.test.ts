/**
 * Identity persistence, session lifecycle and revocation (P1-030).
 *
 * Real Postgres, same graceful-skip pattern as the sibling suites.
 *
 * The test that matters most is the last one:
 * docs/product/family-lifecycle.md has promised since before any of this
 * existed that "Revocation immediately invalidates protected access
 * tokens/session grants". That promise was unimplementable with a
 * stateless token, which is the entire reason ADR-0006 chose session
 * records. This suite is where it stops being a promise.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { familyRepository, identityRepository } from "../src/repositories/index.js";
import { RepositoryAuthorizationError } from "../src/repositories/errors.js";
import { closePool, getPool, withTransaction } from "../src/db/pool.js";

let dbAvailable = false;

before(async () => {
  try {
    await getPool().query("SELECT 1");
    const check = await getPool().query("SELECT to_regclass('public.sessions') AS exists");
    dbAvailable = Boolean(check.rows[0]?.exists);
  } catch {
    dbAvailable = false;
  }
  if (!dbAvailable) {
    console.log("\n[identity.test.ts] DATABASE_URL unreachable or unmigrated. Skipping -- needs a real Postgres.");
  }
});

after(async () => {
  await closePool();
});

function skipIfNoDb(t: { skip: (reason?: string) => void }): boolean {
  if (!dbAvailable) {
    t.skip("DATABASE_URL unreachable in this environment");
    return true;
  }
  return false;
}

const NOW = "2026-08-19T12:00:00.000Z";
const uniqueEmail = () => `parent-${randomUUID()}@example.test`;

/** A family whose owner is backed by a real Account. */
async function makeFamilyWithAccount() {
  const email = uniqueEmail();
  return withTransaction(async (client) => {
    const account = await identityRepository.registerAccount(client, { email, password: "correct horse battery", now: NOW });
    const familyId = randomUUID();
    await familyRepository.createFamily(client, {
      familyId: familyId as never,
      ownerId: account.parentId as never,
      now: NOW,
    });
    return { account, familyId, email };
  });
}

// ---------------------------------------------------------------------------
// Accounts and credentials
// ---------------------------------------------------------------------------

test("registerAccount creates an account that starts PENDING_VERIFICATION", async (t) => {
  if (skipIfNoDb(t)) return;
  const email = uniqueEmail();
  const account = await withTransaction((c) => identityRepository.registerAccount(c, { email, password: "pw-12345678", now: NOW }));
  assert.equal(account.status, "PENDING_VERIFICATION");
  assert.equal(account.authProvider, "PASSWORD");
});

test("the password hash is never returned on the Account and is a real Argon2id PHC string", async (t) => {
  if (skipIfNoDb(t)) return;
  const email = uniqueEmail();
  const account = await withTransaction((c) => identityRepository.registerAccount(c, { email, password: "pw-12345678", now: NOW }));
  assert.equal(Object.keys(account).includes("passwordHash"), false, "Account must never carry the hash (ADR-0006 D4)");

  const { rows } = await getPool().query("SELECT password_hash, algorithm FROM credentials WHERE account_id = $1", [
    account.accountId,
  ]);
  assert.equal(rows[0].algorithm, "ARGON2ID");
  assert.match(rows[0].password_hash, /^\$argon2id\$/, "must be a real Argon2id PHC string, not a plaintext or weak digest");
  assert.equal(rows[0].password_hash.includes("pw-12345678"), false, "the password must not appear in the stored hash");
});

test("email uniqueness is case-insensitive -- Parent@x and parent@x are one account", async (t) => {
  if (skipIfNoDb(t)) return;
  const email = uniqueEmail();
  await withTransaction((c) => identityRepository.registerAccount(c, { email, password: "pw-12345678", now: NOW }));
  await assert.rejects(
    () =>
      withTransaction((c) =>
        identityRepository.registerAccount(c, { email: email.toUpperCase(), password: "other-pw", now: NOW }),
      ),
    // Treating them as two accounts would be an account-takeover foothold.
    (err: unknown) => err instanceof Error && err.name === "RepositoryConflictError",
  );
});

test("verifyPassword accepts the right password and rejects a wrong one", async (t) => {
  if (skipIfNoDb(t)) return;
  const email = uniqueEmail();
  await withTransaction((c) => identityRepository.registerAccount(c, { email, password: "correct horse", now: NOW }));

  const ok = await withTransaction((c) => identityRepository.verifyPassword(c, email, "correct horse"));
  assert.ok(ok, "the correct password must authenticate");
  const bad = await withTransaction((c) => identityRepository.verifyPassword(c, email, "wrong horse"));
  assert.equal(bad, null);
});

test("verifyPassword returns null for an unknown email -- no account-enumeration signal", async (t) => {
  if (skipIfNoDb(t)) return;
  const result = await withTransaction((c) => identityRepository.verifyPassword(c, uniqueEmail(), "anything"));
  // Same undifferentiated null as a wrong password: distinguishing them
  // tells an attacker which emails are registered.
  assert.equal(result, null);
});

test("a SUSPENDED account cannot authenticate even with the correct password", async (t) => {
  if (skipIfNoDb(t)) return;
  const email = uniqueEmail();
  const account = await withTransaction((c) => identityRepository.registerAccount(c, { email, password: "correct horse", now: NOW }));
  await getPool().query("UPDATE accounts SET status = 'SUSPENDED' WHERE account_id = $1", [account.accountId]);
  const result = await withTransaction((c) => identityRepository.verifyPassword(c, email, "correct horse"));
  assert.equal(result, null);
});

test("acceptConsent moves an account to ACTIVE and records the timestamp", async (t) => {
  if (skipIfNoDb(t)) return;
  const email = uniqueEmail();
  const account = await withTransaction((c) => identityRepository.registerAccount(c, { email, password: "pw-12345678", now: NOW }));
  const active = await withTransaction((c) => identityRepository.acceptConsent(c, account.accountId, NOW));
  assert.equal(active.status, "ACTIVE");
  assert.equal(active.consentAcceptedAt, NOW);

  // Not repeatable -- consent is accepted once.
  await assert.rejects(
    () => withTransaction((c) => identityRepository.acceptConsent(c, account.accountId, NOW)),
    RepositoryAuthorizationError,
  );
});

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

test("a parent session is issued and validates", async (t) => {
  if (skipIfNoDb(t)) return;
  const { account, familyId } = await makeFamilyWithAccount();
  const session = await withTransaction((c) => identityRepository.issueParentSession(c, { account, familyId, now: NOW }));
  assert.equal(session.subjectKind, "PARENT");
  assert.equal(session.accountId, account.accountId);

  const found = await withTransaction((c) => identityRepository.findActiveSession(c, session.sessionId, NOW));
  assert.ok(found);
  assert.equal(found!.sessionId, session.sessionId);
});

test("a parent session is refused for a family the parent is not a member of", async (t) => {
  if (skipIfNoDb(t)) return;
  const { account } = await makeFamilyWithAccount();
  const other = await makeFamilyWithAccount();
  // Authenticating proves who you are, not what you may act on.
  await assert.rejects(
    () => withTransaction((c) => identityRepository.issueParentSession(c, { account, familyId: other.familyId, now: NOW })),
    RepositoryAuthorizationError,
  );
});

test("an expired session does not validate", async (t) => {
  if (skipIfNoDb(t)) return;
  const { account, familyId } = await makeFamilyWithAccount();
  const session = await withTransaction((c) =>
    identityRepository.issueParentSession(c, { account, familyId, now: NOW, ttlSeconds: 60 }),
  );
  const later = "2026-08-19T12:02:00.000Z";
  assert.equal(await withTransaction((c) => identityRepository.findActiveSession(c, session.sessionId, later)), null);
});

test("child sessions are always parent-provisioned and carry no account", async (t) => {
  if (skipIfNoDb(t)) return;
  const { account, familyId } = await makeFamilyWithAccount();
  const childId = randomUUID();
  await withTransaction((c) =>
    familyRepository.addChild(c, familyId, {
      childId: childId as never,
      displayName: "Аня",
      birthYear: 2018,
      actorId: account.parentId as never,
      now: NOW,
    }),
  );

  const session = await withTransaction((c) =>
    identityRepository.provisionChildSession(c, {
      familyId,
      childId,
      issuedByParentId: account.parentId,
      now: NOW,
    }),
  );
  assert.equal(session.subjectKind, "CHILD");
  assert.equal(session.childId, childId);
  assert.equal(session.issuedByParentId, account.parentId);
  // ADR-0006 D3: a child never holds a credential, so never an account.
  assert.equal(session.accountId, undefined);
});

test("a parent cannot provision a session for another family's child", async (t) => {
  if (skipIfNoDb(t)) return;
  const a = await makeFamilyWithAccount();
  const b = await makeFamilyWithAccount();
  const otherChildId = randomUUID();
  await withTransaction((c) =>
    familyRepository.addChild(c, b.familyId, {
      childId: otherChildId as never,
      displayName: "Ваня",
      birthYear: 2016,
      actorId: b.account.parentId as never,
      now: NOW,
    }),
  );

  // Same class of gap RT-016 found in assignTask, closed here too.
  await assert.rejects(
    () =>
      withTransaction((c) =>
        identityRepository.provisionChildSession(c, {
          familyId: a.familyId,
          childId: otherChildId,
          issuedByParentId: a.account.parentId,
          now: NOW,
        }),
      ),
    RepositoryAuthorizationError,
  );
});

test("revokeSession makes a live session stop validating, and is idempotent", async (t) => {
  if (skipIfNoDb(t)) return;
  const { account, familyId } = await makeFamilyWithAccount();
  const session = await withTransaction((c) => identityRepository.issueParentSession(c, { account, familyId, now: NOW }));
  await withTransaction((c) => identityRepository.revokeSession(c, session.sessionId, NOW));
  assert.equal(await withTransaction((c) => identityRepository.findActiveSession(c, session.sessionId, NOW)), null);
  // Signing out twice is not an error.
  await withTransaction((c) => identityRepository.revokeSession(c, session.sessionId, NOW));
});

// ---------------------------------------------------------------------------
// The promise this whole design exists to keep
// ---------------------------------------------------------------------------

test("revokeParent immediately invalidates that parent's live sessions", async (t) => {
  if (skipIfNoDb(t)) return;
  // docs/product/family-lifecycle.md: "Revocation immediately invalidates
  // protected access tokens/session grants." Unimplementable with a
  // stateless token -- the reason ADR-0006 chose session records.
  const owner = await makeFamilyWithAccount();
  const secondEmail = uniqueEmail();

  // A second parent, invited and accepted, then given a live session.
  const second = await withTransaction(async (c) => {
    const acc = await identityRepository.registerAccount(c, { email: secondEmail, password: "pw-12345678", now: NOW });
    const tokenId = randomUUID();
    await familyRepository.inviteParent(c, owner.familyId, {
      tokenId: tokenId as never,
      inviteeId: acc.parentId as never,
      capabilities: ["CHILD_POLICY"],
      actorId: owner.account.parentId as never,
      now: NOW,
    });
    await familyRepository.acceptInvitation(c, owner.familyId, tokenId, {
      actorId: acc.parentId as never,
      now: NOW,
    });
    return acc;
  });

  const session = await withTransaction((c) =>
    identityRepository.issueParentSession(c, { account: second, familyId: owner.familyId, now: NOW }),
  );
  assert.ok(
    await withTransaction((c) => identityRepository.findActiveSession(c, session.sessionId, NOW)),
    "precondition: the second parent has a live session",
  );

  const result = await withTransaction((c) =>
    familyRepository.revokeParent(c, owner.familyId, {
      targetId: second.parentId as never,
      actorId: owner.account.parentId as never,
      now: NOW,
    }),
  );

  assert.equal(result.sessionsRevoked, 1, "revocation must report what it actually cut");
  assert.equal(
    await withTransaction((c) => identityRepository.findActiveSession(c, session.sessionId, NOW)),
    null,
    "the revoked parent's session must stop working immediately -- this is the promise",
  );
});

test("revoking one parent does not disturb another parent's session", async (t) => {
  if (skipIfNoDb(t)) return;
  const owner = await makeFamilyWithAccount();
  const ownerSession = await withTransaction((c) =>
    identityRepository.issueParentSession(c, { account: owner.account, familyId: owner.familyId, now: NOW }),
  );

  const stranger = await makeFamilyWithAccount();
  await withTransaction((c) => familyRepository.revokeParent(c, stranger.familyId, {
    targetId: randomUUID() as never,
    actorId: stranger.account.parentId as never,
    now: NOW,
  })).catch(() => {
    // Revoking a non-member is a domain error; irrelevant to this test's
    // point, which is that the owner's unrelated session survives.
  });

  assert.ok(
    await withTransaction((c) => identityRepository.findActiveSession(c, ownerSession.sessionId, NOW)),
    "an unrelated parent's session must survive someone else's revocation",
  );
});
