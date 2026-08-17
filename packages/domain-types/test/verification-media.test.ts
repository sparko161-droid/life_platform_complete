import assert from "node:assert/strict";
import { test } from "node:test";
import { VerificationResultSchema } from "../src/verification.js";
import { MediaEvidenceSchema } from "../src/media.js";

const CHILD_ID = "33333333-3333-4333-8333-333333333333";
const FAMILY_ID = "11111111-1111-4111-8111-111111111111";
const ASSIGNMENT_ID = "55555555-5555-4555-8555-555555555555";

test("a camera-exercise verification result parses without any media reference", () => {
  const result = VerificationResultSchema.parse({
    taskAssignmentId: ASSIGNMENT_ID,
    childId: CHILD_ID,
    strategy: "CAMERA_EXERCISE",
    outcome: "PASSED",
    verifiedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(result.mediaEvidenceId, undefined);
});

test("verification result rejects an unknown outcome", () => {
  assert.throws(() =>
    VerificationResultSchema.parse({
      taskAssignmentId: ASSIGNMENT_ID,
      childId: CHILD_ID,
      strategy: "TIMER",
      outcome: "MAYBE",
      verifiedAt: "2026-01-01T00:00:00.000Z",
    }),
  );
});

test("media evidence never carries a public URL field, only an opaque storage key", () => {
  const evidence = MediaEvidenceSchema.parse({
    mediaEvidenceId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    kind: "PHOTO",
    storageKey: "families/11111111/evidence/abc123.jpg",
    contentType: "image/jpeg",
    sizeBytes: 204800,
    uploadedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal("url" in evidence, false);
  assert.equal("publicUrl" in evidence, false);
});
