/**
 * Tests for the family lifecycle domain service (P1-001).
 *
 * Strategy per task-registry (test_strategy: "Domain, integration,
 * negative authorization and family-isolation tests."):
 *   - Happy path: full registration flow
 *   - State machine: family transitions
 *   - Negative: unauthorized actors, wrong family, expired tokens
 *   - Authorization: capability gate, owner-only operations
 *   - Audit evidence: every mutation produces at least one event
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { InvitationToken } from "../src/family.js";
import {
  FamilyDomainError,
  acceptInvitation,
  addChild,
  createFamily,
  inviteParent,
  revokeParent,
  transitionFamilyStatus,
} from "../src/family-service.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FAMILY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as const;
const OWNER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" as const;
const SECOND_PARENT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc" as const;
const CHILD_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd" as const;
const TOKEN_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" as const;
const T0 = "2026-01-01T00:00:00.000Z";
const T1 = "2026-01-01T01:00:00.000Z";
const T2 = "2026-01-01T02:00:00.000Z";

function makeFamily() {
  return createFamily({ familyId: FAMILY_ID as any, ownerId: OWNER_ID as any, now: T0 }).next;
}

// ---------------------------------------------------------------------------
// createFamily
// ---------------------------------------------------------------------------

test("createFamily: owner starts ACTIVE with all capabilities", () => {
  const { next: family, events } = createFamily({
    familyId: FAMILY_ID as any,
    ownerId: OWNER_ID as any,
    now: T0,
  });

  assert.equal(family.familyId, FAMILY_ID);
  assert.equal(family.status, "ACTIVE");
  assert.equal(family.version, 1);
  assert.equal(family.parents.length, 1);
  assert.equal(family.children.length, 0);

  const owner = family.parents[0];
  assert.equal(owner.parentId, OWNER_ID);
  assert.equal(owner.status, "ACTIVE");
  assert.equal(owner.isFamilyOwner, true);
  assert.deepEqual(owner.capabilities, [
    "CHILD_POLICY",
    "MONEY_REWARDS",
    "SOCIAL_PERMISSIONS",
    "CHAT_VISIBILITY",
    "ACCOUNT_DELETION",
  ]);

  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, "FAMILY_CREATED");
  assert.equal(events[0].familyId, FAMILY_ID);
  assert.equal(events[0].version, 1);
});

// ---------------------------------------------------------------------------
// addChild
// ---------------------------------------------------------------------------

test("addChild: owner adds a child; version increments", () => {
  const family = makeFamily();
  const { next, events } = addChild(family, {
    childId: CHILD_ID as any,
    displayName: "Аня",
    birthYear: 2016,
    actorId: OWNER_ID as any,
    now: T1,
  });

  assert.equal(next.version, 2);
  assert.equal(next.children.length, 1);
  const child = next.children[0];
  assert.equal(child.childId, CHILD_ID);
  assert.equal(child.displayName, "Аня");
  assert.equal(child.birthYear, 2016);
  assert.equal(child.familyId, FAMILY_ID);

  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, "CHILD_ADDED");
  assert.equal(events[0].childId, CHILD_ID);
});

test("addChild: non-member actor is rejected", () => {
  const family = makeFamily();
  assert.throws(
    () =>
      addChild(family, {
        childId: CHILD_ID as any,
        displayName: "Аня",
        birthYear: 2016,
        actorId: SECOND_PARENT_ID as any,
        now: T1,
      }),
    (err: unknown) => err instanceof FamilyDomainError && err.code === "ADD_CHILD_UNAUTHORIZED",
  );
});

test("addChild: duplicate child id is rejected", () => {
  const family = makeFamily();
  const { next: familyWithChild } = addChild(family, {
    childId: CHILD_ID as any,
    displayName: "Аня",
    birthYear: 2016,
    actorId: OWNER_ID as any,
    now: T1,
  });

  assert.throws(
    () =>
      addChild(familyWithChild, {
        childId: CHILD_ID as any,
        displayName: "Аня v2",
        birthYear: 2016,
        actorId: OWNER_ID as any,
        now: T2,
      }),
    (err: unknown) => err instanceof FamilyDomainError && err.code === "ADD_CHILD_DUPLICATE",
  );
});

test("addChild: second parent without CHILD_POLICY is rejected", () => {
  const family = makeFamily();
  // Invite a second parent without CHILD_POLICY
  const { next: inviteResult } = inviteParent(family, {
    tokenId: TOKEN_ID as any,
    inviteeId: SECOND_PARENT_ID as any,
    capabilities: ["MONEY_REWARDS"], // no CHILD_POLICY
    actorId: OWNER_ID as any,
    now: T0,
    expiresAt: "2026-01-03T00:00:00.000Z",
  });
  const { next: acceptResult } = acceptInvitation(inviteResult.family, inviteResult.token, {
    actorId: SECOND_PARENT_ID as any,
    now: T1,
  });
  const familyWithSecond = acceptResult.family;

  assert.throws(
    () =>
      addChild(familyWithSecond, {
        childId: CHILD_ID as any,
        displayName: "Аня",
        birthYear: 2016,
        actorId: SECOND_PARENT_ID as any,
        now: T2,
      }),
    (err: unknown) => err instanceof FamilyDomainError && err.code === "ADD_CHILD_MISSING_CAPABILITY",
  );
});

// ---------------------------------------------------------------------------
// inviteParent
// ---------------------------------------------------------------------------

test("inviteParent: owner creates an invitation token", () => {
  const family = makeFamily();
  const { next: result, events } = inviteParent(family, {
    tokenId: TOKEN_ID as any,
    inviteeId: SECOND_PARENT_ID as any,
    capabilities: ["CHILD_POLICY", "MONEY_REWARDS"],
    actorId: OWNER_ID as any,
    now: T0,
    expiresAt: "2026-01-03T00:00:00.000Z",
  });

  assert.equal(result.family.version, 2);
  assert.equal(result.token.status, "PENDING");
  assert.equal(result.token.inviteeId, SECOND_PARENT_ID);
  assert.equal(result.token.familyId, FAMILY_ID);
  assert.deepEqual(result.token.capabilities, ["CHILD_POLICY", "MONEY_REWARDS"]);

  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, "PARENT_INVITED");
});

test("inviteParent: non-owner is rejected", () => {
  const family = makeFamily();
  // Give second parent membership but not ownership
  const { next: inviteResult } = inviteParent(family, {
    tokenId: TOKEN_ID as any,
    inviteeId: SECOND_PARENT_ID as any,
    capabilities: ["CHILD_POLICY"],
    actorId: OWNER_ID as any,
    now: T0,
    expiresAt: "2026-01-03T00:00:00.000Z",
  });
  const { next: acceptResult } = acceptInvitation(inviteResult.family, inviteResult.token, {
    actorId: SECOND_PARENT_ID as any,
    now: T1,
  });
  const familyWithSecond = acceptResult.family;

  const tokenId2 = "ffffffff-ffff-4fff-8fff-ffffffffffff";
  assert.throws(
    () =>
      inviteParent(familyWithSecond, {
        tokenId: tokenId2 as any,
        inviteeId: OWNER_ID as any,
        capabilities: [],
        actorId: SECOND_PARENT_ID as any,
        now: T2,
      }),
    (err: unknown) => err instanceof FamilyDomainError && err.code === "INVITE_PARENT_NOT_OWNER",
  );
});

test("inviteParent: default expiry is 48h after now", () => {
  const family = makeFamily();
  const { next: result } = inviteParent(family, {
    tokenId: TOKEN_ID as any,
    inviteeId: SECOND_PARENT_ID as any,
    capabilities: [],
    actorId: OWNER_ID as any,
    now: T0,
    // no expiresAt
  });

  const expectedExpiry = new Date(new Date(T0).getTime() + 48 * 3600 * 1000).toISOString();
  assert.equal(result.token.expiresAt, expectedExpiry);
});

// ---------------------------------------------------------------------------
// acceptInvitation
// ---------------------------------------------------------------------------

test("acceptInvitation: happy path adds second parent to family", () => {
  const family = makeFamily();
  const { next: inviteResult } = inviteParent(family, {
    tokenId: TOKEN_ID as any,
    inviteeId: SECOND_PARENT_ID as any,
    capabilities: ["CHILD_POLICY"],
    actorId: OWNER_ID as any,
    now: T0,
    expiresAt: "2026-01-03T00:00:00.000Z",
  });

  const { next: acceptResult, events } = acceptInvitation(inviteResult.family, inviteResult.token, {
    actorId: SECOND_PARENT_ID as any,
    now: T1,
  });

  const nextFamily = acceptResult.family;
  assert.equal(nextFamily.parents.length, 2);
  const second = nextFamily.parents.find((p) => p.parentId === SECOND_PARENT_ID);
  assert.ok(second);
  assert.equal(second.status, "ACTIVE");
  assert.equal(second.isFamilyOwner, false);
  assert.deepEqual(second.capabilities, ["CHILD_POLICY"]);
  assert.equal(second.activatedAt, T1);

  assert.equal(acceptResult.token.status, "ACCEPTED");
  assert.equal(acceptResult.token.acceptedAt, T1);

  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, "PARENT_INVITATION_ACCEPTED");
});

test("acceptInvitation: wrong actor is rejected", () => {
  const family = makeFamily();
  const { next: inviteResult } = inviteParent(family, {
    tokenId: TOKEN_ID as any,
    inviteeId: SECOND_PARENT_ID as any,
    capabilities: [],
    actorId: OWNER_ID as any,
    now: T0,
    expiresAt: "2026-01-03T00:00:00.000Z",
  });

  assert.throws(
    () =>
      acceptInvitation(inviteResult.family, inviteResult.token, {
        actorId: OWNER_ID as any, // wrong — should be SECOND_PARENT_ID
        now: T1,
      }),
    (err: unknown) => err instanceof FamilyDomainError && err.code === "ACCEPT_INVITATION_WRONG_ACTOR",
  );
});

test("acceptInvitation: expired token is rejected", () => {
  const family = makeFamily();
  const { next: inviteResult } = inviteParent(family, {
    tokenId: TOKEN_ID as any,
    inviteeId: SECOND_PARENT_ID as any,
    capabilities: [],
    actorId: OWNER_ID as any,
    now: T0,
    expiresAt: "2026-01-01T00:30:00.000Z", // expires 30 min after T0
  });

  assert.throws(
    () =>
      acceptInvitation(inviteResult.family, inviteResult.token, {
        actorId: SECOND_PARENT_ID as any,
        now: "2026-01-01T01:00:00.000Z", // T1 — past expiry
      }),
    (err: unknown) => err instanceof FamilyDomainError && err.code === "ACCEPT_INVITATION_EXPIRED",
  );
});

test("acceptInvitation: already-accepted token is rejected", () => {
  const family = makeFamily();
  const { next: inviteResult } = inviteParent(family, {
    tokenId: TOKEN_ID as any,
    inviteeId: SECOND_PARENT_ID as any,
    capabilities: [],
    actorId: OWNER_ID as any,
    now: T0,
    expiresAt: "2026-01-03T00:00:00.000Z",
  });

  const { next: acceptResult } = acceptInvitation(inviteResult.family, inviteResult.token, {
    actorId: SECOND_PARENT_ID as any,
    now: T1,
  });

  // Try to accept the already-accepted token again
  assert.throws(
    () =>
      acceptInvitation(acceptResult.family, acceptResult.token, {
        actorId: SECOND_PARENT_ID as any,
        now: T2,
      }),
    (err: unknown) => err instanceof FamilyDomainError && err.code === "ACCEPT_INVITATION_NOT_PENDING",
  );
});

// ---------------------------------------------------------------------------
// revokeParent
// ---------------------------------------------------------------------------

test("revokeParent: owner revokes a second parent", () => {
  const family = makeFamily();
  const { next: inviteResult } = inviteParent(family, {
    tokenId: TOKEN_ID as any,
    inviteeId: SECOND_PARENT_ID as any,
    capabilities: ["CHILD_POLICY"],
    actorId: OWNER_ID as any,
    now: T0,
    expiresAt: "2026-01-03T00:00:00.000Z",
  });
  const { next: acceptResult } = acceptInvitation(inviteResult.family, inviteResult.token, {
    actorId: SECOND_PARENT_ID as any,
    now: T1,
  });
  const familyWithSecond = acceptResult.family;

  const { next: revoked, events } = revokeParent(familyWithSecond, {
    targetId: SECOND_PARENT_ID as any,
    actorId: OWNER_ID as any,
    now: T2,
  });

  const second = revoked.parents.find((p) => p.parentId === SECOND_PARENT_ID);
  assert.ok(second);
  assert.equal(second.status, "REVOKED");
  assert.equal(second.revokedAt, T2);

  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, "PARENT_MEMBERSHIP_REVOKED");
});

test("revokeParent: self-revoke is rejected", () => {
  const family = makeFamily();
  assert.throws(
    () =>
      revokeParent(family, {
        targetId: OWNER_ID as any,
        actorId: OWNER_ID as any,
        now: T1,
      }),
    (err: unknown) => err instanceof FamilyDomainError && err.code === "REVOKE_PARENT_SELF_REVOKE",
  );
});

test("revokeParent: revoking non-member is rejected", () => {
  const family = makeFamily();
  assert.throws(
    () =>
      revokeParent(family, {
        targetId: SECOND_PARENT_ID as any, // not a member
        actorId: OWNER_ID as any,
        now: T1,
      }),
    (err: unknown) => err instanceof FamilyDomainError && err.code === "REVOKE_PARENT_NOT_MEMBER",
  );
});

// ---------------------------------------------------------------------------
// Audit evidence: every mutation produces at least one event
// ---------------------------------------------------------------------------

test("audit evidence: every mutation produces at least one event with the correct familyId", () => {
  const family = makeFamily();

  // addChild
  const { events: addChildEvents } = addChild(family, {
    childId: CHILD_ID as any,
    displayName: "Аня",
    birthYear: 2016,
    actorId: OWNER_ID as any,
    now: T0,
  });
  assert.ok(addChildEvents.length > 0);
  for (const e of addChildEvents) assert.equal(e.familyId, FAMILY_ID);

  // inviteParent
  const { next: inviteResult, events: inviteEvents } = inviteParent(family, {
    tokenId: TOKEN_ID as any,
    inviteeId: SECOND_PARENT_ID as any,
    capabilities: [],
    actorId: OWNER_ID as any,
    now: T0,
    expiresAt: "2026-01-03T00:00:00.000Z",
  });
  assert.ok(inviteEvents.length > 0);
  for (const e of inviteEvents) assert.equal(e.familyId, FAMILY_ID);

  // acceptInvitation
  const { events: acceptEvents } = acceptInvitation(inviteResult.family, inviteResult.token, {
    actorId: SECOND_PARENT_ID as any,
    now: T1,
  });
  assert.ok(acceptEvents.length > 0);
  for (const e of acceptEvents) assert.equal(e.familyId, FAMILY_ID);
});

// ---------------------------------------------------------------------------
// Full registration flow (integration-style)
// ---------------------------------------------------------------------------

test("full onboarding: create family -> add child -> invite second parent -> accept -> child is visible to second parent", () => {
  // Step 1: Create family
  const { next: family1 } = createFamily({
    familyId: FAMILY_ID as any,
    ownerId: OWNER_ID as any,
    now: T0,
  });
  assert.equal(family1.status, "ACTIVE");

  // Step 2: Add child
  const { next: family2 } = addChild(family1, {
    childId: CHILD_ID as any,
    displayName: "Аня",
    birthYear: 2016,
    actorId: OWNER_ID as any,
    now: T0,
  });
  assert.equal(family2.children.length, 1);

  // Step 3: Invite second parent with CHILD_POLICY
  const { next: inviteResult } = inviteParent(family2, {
    tokenId: TOKEN_ID as any,
    inviteeId: SECOND_PARENT_ID as any,
    capabilities: ["CHILD_POLICY", "MONEY_REWARDS"],
    actorId: OWNER_ID as any,
    now: T1,
    expiresAt: "2026-01-03T00:00:00.000Z",
  });

  // Step 4: Second parent accepts
  const { next: acceptResult } = acceptInvitation(inviteResult.family, inviteResult.token, {
    actorId: SECOND_PARENT_ID as any,
    now: T2,
  });

  const finalFamily = acceptResult.family;
  assert.equal(finalFamily.parents.length, 2);
  assert.equal(finalFamily.children.length, 1);

  const secondParent = finalFamily.parents.find((p) => p.parentId === SECOND_PARENT_ID);
  assert.ok(secondParent);
  assert.equal(secondParent.status, "ACTIVE");
  assert.ok(secondParent.capabilities.includes("CHILD_POLICY"));
  assert.ok(secondParent.capabilities.includes("MONEY_REWARDS"));

  // Second parent with CHILD_POLICY can now add another child
  const { next: family5 } = addChild(finalFamily, {
    childId: "11111111-1111-4111-8111-111111111112" as any,
    displayName: "Борис",
    birthYear: 2018,
    actorId: SECOND_PARENT_ID as any,
    now: T2,
  });
  assert.equal(family5.children.length, 2);
});

// ---------------------------------------------------------------------------
// transitionFamilyStatus
// ---------------------------------------------------------------------------

test("transitionFamilyStatus: owner can suspend and reactivate", () => {
  const family = makeFamily();

  const { next: suspended } = transitionFamilyStatus(family, "SUSPENDED", OWNER_ID as any, T1);
  assert.equal(suspended.status, "SUSPENDED");
  assert.equal(suspended.version, 2);

  const { next: reactivated } = transitionFamilyStatus(suspended, "ACTIVE", OWNER_ID as any, T2);
  assert.equal(reactivated.status, "ACTIVE");
  assert.equal(reactivated.version, 3);
});

test("transitionFamilyStatus: invalid transition is rejected (ARCHIVED -> ACTIVE)", () => {
  // First archive the family
  const family = makeFamily();
  const { next: archived } = transitionFamilyStatus(family, "SUSPENDED", OWNER_ID as any, T1);
  const { next: fullyArchived } = transitionFamilyStatus(archived, "ARCHIVED", OWNER_ID as any, T1);

  // ARCHIVED is terminal — cannot go back to ACTIVE
  assert.throws(
    () => transitionFamilyStatus(fullyArchived, "ACTIVE", OWNER_ID as any, T2),
    (err: unknown) => err instanceof FamilyDomainError && err.code === "TRANSITION_FAMILY_INVALID",
  );
});
