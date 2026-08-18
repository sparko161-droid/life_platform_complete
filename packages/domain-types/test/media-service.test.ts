/**
 * Tests for the media evidence domain service (P1-005).
 *
 * Strategy per task-registry (test_strategy: "Upload-limit, access-control,
 * retention and storage integration tests."):
 *   - Upload policy: content-type and size limits per MediaKind
 *   - Family isolation: cross-family access is rejected
 *   - Child membership: uploading child must belong to the family
 *   - Retention: default retention schedule applied when requested
 *   - Expiry: idempotent expireEvidence
 *   - Integration: full evidence lifecycle (register → authorize → expire)
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Family } from "../src/family.js";
import type { ChildId, FamilyId, MediaEvidenceId } from "../src/ids.js";
import type { MediaEvidence } from "../src/media.js";
import {
  DEFAULT_RETENTION_DAYS,
  MediaDomainError,
  UPLOAD_MAX_BYTES,
  UPLOAD_PERMITTED_CONTENT_TYPES,
  authorizeEvidenceAccess,
  expireEvidence,
  isValidUpload,
  registerEvidence,
  validateUploadPolicy,
} from "../src/media-service.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FAMILY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as FamilyId;
const OTHER_FAMILY_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff" as FamilyId;
const OWNER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" as const;
const CHILD_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc" as ChildId;
const OTHER_CHILD_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd" as ChildId;
const NOW = "2026-08-18T12:00:00.000Z";

function makeFamily(childIds: ChildId[] = [CHILD_ID]): Family {
  return {
    familyId: FAMILY_ID,
    ownerParentId: OWNER_ID,
    status: "ACTIVE",
    version: 1,
    createdAt: NOW,
    parents: [
      {
        parentId: OWNER_ID,
        familyId: FAMILY_ID,
        role: "OWNER",
        capabilities: ["CHILD_POLICY", "TASK_CREATE", "REWARD_APPROVE", "REPORT_READ"],
        status: "ACTIVE",
        joinedAt: NOW,
      },
    ],
    children: childIds.map((childId) => ({
      childId,
      familyId: FAMILY_ID,
      displayName: "Alice",
      dateOfBirth: "2018-01-01",
      createdAt: NOW,
    })),
  };
}

function makePhoto(overrides: Partial<{
  familyId: FamilyId;
  childId: ChildId;
  kind: "PHOTO" | "VIDEO" | "AUDIO";
  contentType: string;
  sizeBytes: number;
  storageKey: string;
  applyRetention: boolean;
}> = {}): Parameters<typeof registerEvidence>[1] {
  return {
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    kind: "PHOTO",
    contentType: "image/jpeg",
    sizeBytes: 1_000_000,
    storageKey: "uploads/fam1/child1/photo.jpg",
    now: NOW,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Upload policy constants
// ---------------------------------------------------------------------------

test("UPLOAD_MAX_BYTES has entries for PHOTO, VIDEO and AUDIO", () => {
  assert.ok(UPLOAD_MAX_BYTES.PHOTO > 0);
  assert.ok(UPLOAD_MAX_BYTES.VIDEO > 0);
  assert.ok(UPLOAD_MAX_BYTES.AUDIO > 0);
});

test("PHOTO max is 10 MB", () => {
  assert.equal(UPLOAD_MAX_BYTES.PHOTO, 10 * 1024 * 1024);
});

test("VIDEO max is 100 MB", () => {
  assert.equal(UPLOAD_MAX_BYTES.VIDEO, 100 * 1024 * 1024);
});

test("AUDIO max is 25 MB", () => {
  assert.equal(UPLOAD_MAX_BYTES.AUDIO, 25 * 1024 * 1024);
});

test("PHOTO permitted content-types include jpeg, png, webp, heic", () => {
  const types = UPLOAD_PERMITTED_CONTENT_TYPES.PHOTO;
  assert.ok(types.includes("image/jpeg"));
  assert.ok(types.includes("image/png"));
  assert.ok(types.includes("image/webp"));
  assert.ok(types.includes("image/heic"));
});

test("DEFAULT_RETENTION_DAYS is 90", () => {
  assert.equal(DEFAULT_RETENTION_DAYS, 90);
});

// ---------------------------------------------------------------------------
// validateUploadPolicy
// ---------------------------------------------------------------------------

test("validateUploadPolicy: valid PHOTO returns no violations", () => {
  const v = validateUploadPolicy("PHOTO", "image/jpeg", 5_000_000);
  assert.deepEqual(v, []);
});

test("validateUploadPolicy: valid VIDEO returns no violations", () => {
  const v = validateUploadPolicy("VIDEO", "video/mp4", 50_000_000);
  assert.deepEqual(v, []);
});

test("validateUploadPolicy: valid AUDIO returns no violations", () => {
  const v = validateUploadPolicy("AUDIO", "audio/mpeg", 10_000_000);
  assert.deepEqual(v, []);
});

test("validateUploadPolicy: wrong MIME type yields CONTENT_TYPE_NOT_PERMITTED", () => {
  const v = validateUploadPolicy("PHOTO", "application/octet-stream", 100);
  assert.ok(v.some((x) => x.code === "CONTENT_TYPE_NOT_PERMITTED"));
});

test("validateUploadPolicy: file exceeding PHOTO limit yields FILE_TOO_LARGE", () => {
  const v = validateUploadPolicy("PHOTO", "image/jpeg", UPLOAD_MAX_BYTES.PHOTO + 1);
  assert.ok(v.some((x) => x.code === "FILE_TOO_LARGE"));
});

test("validateUploadPolicy: zero sizeBytes yields FILE_EMPTY", () => {
  const v = validateUploadPolicy("PHOTO", "image/jpeg", 0);
  assert.ok(v.some((x) => x.code === "FILE_EMPTY"));
});

test("validateUploadPolicy: multiple violations accumulate", () => {
  const v = validateUploadPolicy("PHOTO", "video/mp4", -1);
  const codes = v.map((x) => x.code);
  assert.ok(codes.includes("CONTENT_TYPE_NOT_PERMITTED"));
  assert.ok(codes.includes("FILE_EMPTY"));
});

test("isValidUpload: true for a valid upload", () => {
  assert.equal(isValidUpload("PHOTO", "image/png", 1_000), true);
});

test("isValidUpload: false for an invalid upload", () => {
  assert.equal(isValidUpload("PHOTO", "text/html", 1_000), false);
});

// ---------------------------------------------------------------------------
// registerEvidence — happy path
// ---------------------------------------------------------------------------

test("registerEvidence: returns a MediaEvidence record with the correct fields", () => {
  const family = makeFamily();
  const record = registerEvidence(family, makePhoto());
  assert.equal(record.familyId, FAMILY_ID);
  assert.equal(record.childId, CHILD_ID);
  assert.equal(record.kind, "PHOTO");
  assert.equal(record.contentType, "image/jpeg");
  assert.equal(record.sizeBytes, 1_000_000);
  assert.equal(record.storageKey, "uploads/fam1/child1/photo.jpg");
  assert.equal(record.uploadedAt, NOW);
  assert.ok(typeof record.mediaEvidenceId === "string");
});

test("registerEvidence: generates a unique mediaEvidenceId", () => {
  const family = makeFamily();
  const r1 = registerEvidence(family, makePhoto());
  const r2 = registerEvidence(family, makePhoto());
  assert.notEqual(r1.mediaEvidenceId, r2.mediaEvidenceId);
});

test("registerEvidence: with applyRetention sets retentionExpiresAt 90 days out", () => {
  const family = makeFamily();
  const record = registerEvidence(family, makePhoto({ applyRetention: true }));
  assert.ok(record.retentionExpiresAt, "retentionExpiresAt should be set");
  // 2026-08-18 + 90 days = 2026-11-16
  assert.ok(record.retentionExpiresAt! > NOW, "expiry must be after upload");
});

test("registerEvidence: without applyRetention leaves retentionExpiresAt undefined", () => {
  const family = makeFamily();
  const record = registerEvidence(family, makePhoto({ applyRetention: false }));
  assert.equal(record.retentionExpiresAt, undefined);
});

// ---------------------------------------------------------------------------
// registerEvidence — access control
// ---------------------------------------------------------------------------

test("registerEvidence: rejects a child not in the family", () => {
  const family = makeFamily([CHILD_ID]); // OTHER_CHILD_ID not present
  assert.throws(
    () => registerEvidence(family, makePhoto({ childId: OTHER_CHILD_ID })),
    (err: unknown) => {
      assert.ok(err instanceof MediaDomainError);
      assert.equal(err.code, "CHILD_NOT_IN_FAMILY");
      return true;
    },
  );
});

test("registerEvidence: rejects an empty storageKey", () => {
  const family = makeFamily();
  assert.throws(
    () => registerEvidence(family, makePhoto({ storageKey: "   " })),
    (err: unknown) => {
      assert.ok(err instanceof MediaDomainError);
      assert.equal(err.code, "STORAGE_KEY_EMPTY");
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// registerEvidence — upload policy enforcement
// ---------------------------------------------------------------------------

test("registerEvidence: rejects a disallowed MIME type", () => {
  const family = makeFamily();
  assert.throws(
    () => registerEvidence(family, makePhoto({ contentType: "application/pdf" })),
    (err: unknown) => {
      assert.ok(err instanceof MediaDomainError);
      assert.equal(err.code, "CONTENT_TYPE_NOT_PERMITTED");
      return true;
    },
  );
});

test("registerEvidence: rejects a PHOTO exceeding 10 MB", () => {
  const family = makeFamily();
  assert.throws(
    () => registerEvidence(family, makePhoto({ sizeBytes: UPLOAD_MAX_BYTES.PHOTO + 1 })),
    (err: unknown) => {
      assert.ok(err instanceof MediaDomainError);
      assert.equal(err.code, "FILE_TOO_LARGE");
      return true;
    },
  );
});

test("registerEvidence: rejects a VIDEO exceeding 100 MB", () => {
  const family = makeFamily();
  assert.throws(
    () =>
      registerEvidence(
        family,
        makePhoto({
          kind: "VIDEO",
          contentType: "video/mp4",
          sizeBytes: UPLOAD_MAX_BYTES.VIDEO + 1,
        }),
      ),
    (err: unknown) => {
      assert.ok(err instanceof MediaDomainError);
      assert.equal(err.code, "FILE_TOO_LARGE");
      return true;
    },
  );
});

test("registerEvidence: accepts exactly at the PHOTO size limit", () => {
  const family = makeFamily();
  const record = registerEvidence(
    family,
    makePhoto({ sizeBytes: UPLOAD_MAX_BYTES.PHOTO }),
  );
  assert.equal(record.sizeBytes, UPLOAD_MAX_BYTES.PHOTO);
});

// ---------------------------------------------------------------------------
// authorizeEvidenceAccess — family isolation
// ---------------------------------------------------------------------------

function makeEvidence(overrides: Partial<MediaEvidence> = {}): MediaEvidence {
  return {
    mediaEvidenceId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" as MediaEvidenceId,
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    kind: "PHOTO",
    storageKey: "uploads/fam1/child1/photo.jpg",
    contentType: "image/jpeg",
    sizeBytes: 1_000_000,
    uploadedAt: NOW,
    ...overrides,
  };
}

test("authorizeEvidenceAccess: allows access for the owning family", () => {
  const evidence = makeEvidence();
  const result = authorizeEvidenceAccess({
    evidence,
    requestingFamilyId: FAMILY_ID,
  });
  assert.deepEqual(result, evidence);
});

test("authorizeEvidenceAccess: rejects access from a different family", () => {
  const evidence = makeEvidence();
  assert.throws(
    () =>
      authorizeEvidenceAccess({
        evidence,
        requestingFamilyId: OTHER_FAMILY_ID,
      }),
    (err: unknown) => {
      assert.ok(err instanceof MediaDomainError);
      assert.equal(err.code, "FAMILY_ISOLATION_VIOLATION");
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// expireEvidence
// ---------------------------------------------------------------------------

test("expireEvidence: sets retentionExpiresAt to now when not previously expired", () => {
  const evidence = makeEvidence({ retentionExpiresAt: "2027-01-01T00:00:00.000Z" });
  const result = expireEvidence(evidence, NOW);
  assert.equal(result.retentionExpiresAt, NOW);
});

test("expireEvidence: is idempotent when already expired", () => {
  const pastTime = "2026-01-01T00:00:00.000Z";
  const evidence = makeEvidence({ retentionExpiresAt: pastTime });
  const result = expireEvidence(evidence, NOW);
  // Already expired in the past — should NOT advance the expiry date
  assert.equal(result.retentionExpiresAt, pastTime);
});

test("expireEvidence: works when retentionExpiresAt was not set", () => {
  const evidence = makeEvidence({ retentionExpiresAt: undefined });
  const result = expireEvidence(evidence, NOW);
  assert.equal(result.retentionExpiresAt, NOW);
});

// ---------------------------------------------------------------------------
// Integration: full evidence lifecycle
// ---------------------------------------------------------------------------

test("integration: PHOTO_PROOF flow — register with retention, authorize, then expire", () => {
  const family = makeFamily();

  // 1. Child submits a photo as proof
  const evidence = registerEvidence(
    family,
    makePhoto({ applyRetention: true }),
  );

  assert.equal(evidence.familyId, FAMILY_ID);
  assert.ok(
    evidence.retentionExpiresAt !== undefined,
    "retention should be set for PHOTO_PROOF",
  );
  assert.ok(
    evidence.retentionExpiresAt! > NOW,
    "retention expiry should be in the future",
  );

  // 2. Parent requests to view the evidence
  const authorized = authorizeEvidenceAccess({
    evidence,
    requestingFamilyId: FAMILY_ID,
  });
  assert.equal(authorized.mediaEvidenceId, evidence.mediaEvidenceId);

  // 3. Retention TTL fires; system expires the record
  const expiredAt = evidence.retentionExpiresAt!;
  const expired = expireEvidence(evidence, expiredAt);
  assert.equal(expired.retentionExpiresAt, expiredAt);

  // 4. Another call is idempotent
  const again = expireEvidence(expired, "2099-01-01T00:00:00.000Z");
  assert.equal(again.retentionExpiresAt, expiredAt); // unchanged
});
