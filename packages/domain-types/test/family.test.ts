import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ChildProfileSchema,
  FamilySchema,
  ParentMembershipSchema,
  isValidFamilyTransition,
} from "../src/family.js";

const FAMILY_ID = "11111111-1111-4111-8111-111111111111";
const PARENT_ID = "22222222-2222-4222-8222-222222222222";
const CHILD_ID = "33333333-3333-4333-8333-333333333333";

const validParent = {
  parentId: PARENT_ID,
  familyId: FAMILY_ID,
  status: "ACTIVE",
  isFamilyOwner: true,
  capabilities: ["CHILD_POLICY", "MONEY_REWARDS"],
  invitedAt: "2026-01-01T00:00:00.000Z",
  activatedAt: "2026-01-02T00:00:00.000Z",
};

const validChild = {
  childId: CHILD_ID,
  familyId: FAMILY_ID,
  displayName: "Аня",
  birthYear: 2016,
};

test("a well-formed family parses", () => {
  const family = FamilySchema.parse({
    familyId: FAMILY_ID,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
    parents: [validParent],
    children: [validChild],
  });
  assert.equal(family.status, "ACTIVE");
});

test("a family with zero parents is rejected (min(1))", () => {
  assert.throws(() =>
    FamilySchema.parse({
      familyId: FAMILY_ID,
      status: "ACTIVE",
      createdAt: "2026-01-01T00:00:00.000Z",
      parents: [],
      children: [],
    }),
  );
});

test("ParentMembership rejects an unknown capability", () => {
  assert.throws(() =>
    ParentMembershipSchema.parse({ ...validParent, capabilities: ["NOT_A_REAL_CAPABILITY"] }),
  );
});

test("ChildProfile rejects a birthYear outside the plausible range", () => {
  assert.throws(() => ChildProfileSchema.parse({ ...validChild, birthYear: 1990 }));
});

test("family status transitions follow PENDING_INVITE -> ACTIVE -> SUSPENDED/ARCHIVED", () => {
  assert.equal(isValidFamilyTransition("PENDING_INVITE", "ACTIVE"), true);
  assert.equal(isValidFamilyTransition("PENDING_INVITE", "ARCHIVED"), false);
  assert.equal(isValidFamilyTransition("ACTIVE", "SUSPENDED"), true);
  assert.equal(isValidFamilyTransition("SUSPENDED", "ACTIVE"), true);
  assert.equal(isValidFamilyTransition("ARCHIVED", "ACTIVE"), false);
  assert.equal(isValidFamilyTransition("ACTIVE", "ACTIVE"), false);
});
