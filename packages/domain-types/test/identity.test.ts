/**
 * Identity contract tests (P1-029).
 *
 * Strategy per tasks/registry.yaml: "Schema fixtures per entity, a
 * classification-completeness test matching the existing pattern, and a
 * compatibility check proving the contract-pack bump is additive."
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { DATA_CLASSES } from "../src/classification.js";
import {
  ACCOUNT_CLASSIFICATION,
  ACCOUNT_STATUSES,
  AUTH_PROVIDERS,
  AccountSchema,
  CREDENTIAL_RECORD_CLASSIFICATION,
  CredentialRecordSchema,
  SESSION_CLASSIFICATION,
  SessionSchema,
  isSessionActive,
  isValidAccountTransition,
} from "../src/identity.js";

const ACCOUNT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PARENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CHILD_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const FAMILY_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const SESSION_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const NOW = "2026-08-19T12:00:00.000Z";

const account = {
  accountId: ACCOUNT_ID,
  parentId: PARENT_ID,
  email: "parent@example.test",
  authProvider: "PASSWORD",
  status: "ACTIVE",
  version: 1,
  createdAt: NOW,
};

const parentSession = {
  sessionId: SESSION_ID,
  subjectKind: "PARENT",
  accountId: ACCOUNT_ID,
  parentId: PARENT_ID,
  familyId: FAMILY_ID,
  issuedAt: NOW,
  expiresAt: "2026-08-19T13:00:00.000Z",
};

const childSession = {
  sessionId: SESSION_ID,
  subjectKind: "CHILD",
  childId: CHILD_ID,
  familyId: FAMILY_ID,
  issuedByParentId: PARENT_ID,
  issuedAt: NOW,
  expiresAt: "2026-08-19T13:00:00.000Z",
};

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

test("a well-formed account parses", () => {
  assert.equal(AccountSchema.safeParse(account).success, true);
});

test("an account rejects a malformed email", () => {
  assert.equal(AccountSchema.safeParse({ ...account, email: "not-an-email" }).success, false);
});

test("an account rejects an unknown auth provider", () => {
  assert.equal(AccountSchema.safeParse({ ...account, authProvider: "MAGIC_LINK" }).success, false);
});

test("Phase 1 ships exactly one auth provider, with the enum as the seam for more", () => {
  assert.deepEqual([...AUTH_PROVIDERS], ["PASSWORD"]);
});

test("account transitions follow the documented lifecycle", () => {
  assert.equal(isValidAccountTransition("PENDING_VERIFICATION", "ACTIVE"), true);
  assert.equal(isValidAccountTransition("ACTIVE", "SUSPENDED"), true);
  assert.equal(isValidAccountTransition("SUSPENDED", "ACTIVE"), true);
  // CLOSED is terminal, and no state transitions to itself.
  for (const s of ACCOUNT_STATUSES) {
    assert.equal(isValidAccountTransition("CLOSED", s), false, `CLOSED must be terminal (tried ${s})`);
    assert.equal(isValidAccountTransition(s, s), false, `${s} must not transition to itself`);
  }
  // A pending account cannot be suspended -- it was never active.
  assert.equal(isValidAccountTransition("PENDING_VERIFICATION", "SUSPENDED"), false);
});

test("no credential material lives on the Account schema", () => {
  // Keeping the hash off the aggregate read during ordinary authorization
  // is what stops it being logged or serialised into an event payload.
  const keys = Object.keys(AccountSchema.shape);
  for (const forbidden of ["passwordHash", "password", "hash", "secret", "token"]) {
    assert.ok(!keys.includes(forbidden), `Account must not carry ${forbidden}`);
  }
});

// ---------------------------------------------------------------------------
// Credential
// ---------------------------------------------------------------------------

test("a credential record parses and its hash is classified SECRET", () => {
  const record = { accountId: ACCOUNT_ID, algorithm: "ARGON2ID", passwordHash: "$argon2id$v=19$...", updatedAt: NOW };
  assert.equal(CredentialRecordSchema.safeParse(record).success, true);
  assert.equal(
    CREDENTIAL_RECORD_CLASSIFICATION.passwordHash,
    "SECRET",
    "docs/security/data-classification.md reserves SECRET for credential material",
  );
});

// ---------------------------------------------------------------------------
// Session -- the parent/child asymmetry is the security-relevant part
// ---------------------------------------------------------------------------

test("a parent session parses", () => {
  assert.equal(SessionSchema.safeParse(parentSession).success, true);
});

test("a parent session requires both accountId and parentId", () => {
  const { accountId: _a, ...noAccount } = parentSession;
  assert.equal(SessionSchema.safeParse(noAccount).success, false);
  const { parentId: _p, ...noParent } = parentSession;
  assert.equal(SessionSchema.safeParse(noParent).success, false);
});

test("a parent session must not carry a childId", () => {
  assert.equal(SessionSchema.safeParse({ ...parentSession, childId: CHILD_ID }).success, false);
});

test("a child session parses when parent-provisioned", () => {
  assert.equal(SessionSchema.safeParse(childSession).success, true);
});

test("a child session without issuedByParentId is rejected -- child access is always parent-provisioned", () => {
  const { issuedByParentId: _i, ...unprovisioned } = childSession;
  const result = SessionSchema.safeParse(unprovisioned);
  assert.equal(result.success, false);
  assert.ok(
    JSON.stringify(result.error?.issues).includes("parent-provisioned"),
    "the rejection must name the rule, not just fail",
  );
});

test("a child session must not carry an accountId -- a child has no Account by contract", () => {
  assert.equal(SessionSchema.safeParse({ ...childSession, accountId: ACCOUNT_ID }).success, false);
});

test("the session id itself is classified SECRET", () => {
  // Whoever holds it can act as the subject; that is the definition.
  assert.equal(SESSION_CLASSIFICATION.sessionId, "SECRET");
});

test("isSessionActive: a live session is active", () => {
  assert.equal(isSessionActive(SessionSchema.parse(parentSession), NOW), true);
});

test("isSessionActive: an expired session is not active", () => {
  assert.equal(isSessionActive(SessionSchema.parse(parentSession), "2026-08-19T14:00:00.000Z"), false);
});

test("isSessionActive: a revoked session is not active even before expiry", () => {
  // This is the whole reason sessions are records and not bare signed
  // tokens -- family-lifecycle.md promises revocation takes effect
  // immediately, which a stateless token cannot honour.
  const revoked = SessionSchema.parse({ ...parentSession, revokedAt: "2026-08-19T12:30:00.000Z" });
  assert.equal(isSessionActive(revoked, "2026-08-19T12:31:00.000Z"), false);
});

// ---------------------------------------------------------------------------
// Classification completeness -- same pattern as the existing entities
// ---------------------------------------------------------------------------

test("every identity schema field has exactly one classification, and vice versa", () => {
  const pairs = [
    ["Account", AccountSchema, ACCOUNT_CLASSIFICATION],
    ["CredentialRecord", CredentialRecordSchema, CREDENTIAL_RECORD_CLASSIFICATION],
  ] as const;

  for (const [name, schema, map] of pairs) {
    const schemaKeys = Object.keys(schema.shape).sort();
    const mapKeys = Object.keys(map).sort();
    assert.deepEqual(mapKeys, schemaKeys, `${name}'s classification map must match its schema keys exactly`);
    for (const [field, cls] of Object.entries(map)) {
      assert.ok(DATA_CLASSES.includes(cls as never), `${name}.${field} has unknown class ${cls}`);
    }
  }
});

test("Session's classification covers every field its schema defines", () => {
  // SessionSchema is a ZodObject wrapped by .check(), so its shape is
  // reached through the inner object rather than directly.
  const shape = (SessionSchema as unknown as { def: { innerType?: { shape: Record<string, unknown> } }; shape?: Record<string, unknown> });
  const keys = Object.keys(shape.shape ?? shape.def.innerType?.shape ?? {}).sort();
  assert.ok(keys.length > 0, "could not read SessionSchema's shape");
  assert.deepEqual(Object.keys(SESSION_CLASSIFICATION).sort(), keys);
});

// ---------------------------------------------------------------------------
// Additive-only proof (P1-029 acceptance criterion)
// ---------------------------------------------------------------------------

test("adding Identity did not change the shape of any pre-existing schema", async () => {
  // The acceptance criterion is "additive only -- no existing schema
  // changes shape, proven rather than asserted". The realistic way this
  // would be violated is someone later "just adding" a credential field
  // to Family or ChildProfile instead of using Account -- which is
  // exactly what ADR-0006 rejected. Pinning the field sets makes that a
  // failing test rather than a silent contract break.
  const { FamilySchema, ChildProfileSchema, ParentMembershipSchema } = await import("../src/family.js");

  assert.deepEqual(Object.keys(FamilySchema.shape).sort(), [
    "children",
    "createdAt",
    "familyId",
    "parents",
    "status",
    "version",
  ]);
  assert.deepEqual(Object.keys(ChildProfileSchema.shape).sort(), [
    "avatarId",
    "birthYear",
    "childId",
    "displayName",
    "familyId",
  ]);
  assert.deepEqual(Object.keys(ParentMembershipSchema.shape).sort(), [
    "activatedAt",
    "capabilities",
    "familyId",
    "invitedAt",
    "isFamilyOwner",
    "parentId",
    "revokedAt",
    "status",
  ]);
});

test("no pre-existing schema gained a credential field", async () => {
  const family = await import("../src/family.js");
  const forbidden = ["password", "passwordHash", "credential", "secret", "token", "sessionId"];
  for (const [name, schema] of Object.entries(family)) {
    const shape = (schema as { shape?: Record<string, unknown> })?.shape;
    if (!shape) continue;
    for (const key of Object.keys(shape)) {
      assert.ok(
        !forbidden.includes(key),
        `${name} gained credential-shaped field "${key}" -- credentials belong on Account/CredentialRecord (ADR-0006)`,
      );
    }
  }
});
