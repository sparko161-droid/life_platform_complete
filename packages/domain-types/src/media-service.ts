import { randomUUID } from "node:crypto";
import type { Family } from "./family.js";
import type { ChildId, FamilyId, MediaEvidenceId } from "./ids.js";
import {
  type MediaEvidence,
  type MediaKind,
  MediaEvidenceSchema,
} from "./media.js";

/**
 * Media evidence domain service (P1-005).
 *
 * Implements "Media evidence storage and upload policy"
 * (tasks/registry.yaml) as a pure domain layer: every function validates
 * commands against policy and returns the domain record to be persisted.
 * No I/O, no storage calls, no signed-URL generation — those are
 * application-layer concerns.
 *
 * Policy source:
 *   - docs/security/privacy.md  ("private authorized access", "frames
 *     processed locally by default and not retained")
 *   - docs/architecture/data-architecture.md ("Store metadata and storage
 *     keys in PostgreSQL; objects live in S3-compatible storage. Use
 *     signed/authorized access.")
 *   - docs/game/verification.md (PHOTO_PROOF, VIDEO_PROOF, AUDIO_PROOF are
 *     the strategies that retain evidence server-side)
 *   - MASTER_SPEC §8 ("Video by default is not sent to the server; the
 *     server receives the verification result.")
 *
 * Authorization model:
 *   - `registerEvidence`: uploader must be a ChildId that belongs to the
 *     family being written to.
 *   - `authorizeEvidenceAccess`: requestor's familyId must match the record.
 *   - `expireEvidence`: system actor; no family membership required.
 *
 * Upload policy constants are exported so the application layer (HTTP
 * handler, multipart middleware) can enforce them before accepting the
 * object upload, and tests can assert them independently.
 */

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class MediaDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "MediaDomainError";
  }
}

// ---------------------------------------------------------------------------
// Upload policy
// ---------------------------------------------------------------------------

/** Maximum file sizes per MediaKind (bytes). */
export const UPLOAD_MAX_BYTES: Record<MediaKind, number> = {
  PHOTO: 10 * 1024 * 1024,   // 10 MB
  VIDEO: 100 * 1024 * 1024,  // 100 MB
  AUDIO: 25 * 1024 * 1024,   // 25 MB
};

/** Permitted MIME content-types per MediaKind. */
export const UPLOAD_PERMITTED_CONTENT_TYPES: Record<MediaKind, readonly string[]> = {
  PHOTO: ["image/jpeg", "image/png", "image/webp", "image/heic"],
  VIDEO: ["video/mp4", "video/webm", "video/quicktime"],
  AUDIO: ["audio/mpeg", "audio/mp4", "audio/wav", "audio/webm"],
};

/**
 * Default retention period for server-retained evidence (90 days).
 * MASTER_SPEC §8: frames processed locally are never retained.
 * Strategies that do retain (PHOTO_PROOF, VIDEO_PROOF, AUDIO_PROOF) must
 * be bounded by a retention schedule.
 */
export const DEFAULT_RETENTION_DAYS = 90;

// ---------------------------------------------------------------------------
// Command types
// ---------------------------------------------------------------------------

export interface RegisterEvidenceCommand {
  /** The family this evidence belongs to. */
  familyId: FamilyId;
  /** The child who captured and submitted the evidence. */
  childId: ChildId;
  kind: MediaKind;
  /**
   * Opaque storage key from the object-storage layer (S3 key / GCS path).
   * Never a public URL — access is via server-minted signed URLs.
   */
  storageKey: string;
  contentType: string;
  sizeBytes: number;
  /**
   * ISO 8601 datetime of the upload; caller supplies so tests are
   * deterministic. Production callers pass `new Date().toISOString()`.
   */
  now: string;
  /**
   * Whether to apply the default retention schedule. Pass `true` for
   * strategies that retain evidence (PHOTO_PROOF, VIDEO_PROOF, AUDIO_PROOF).
   * Pass `false` for strategies that only touch the server for the result.
   */
  applyRetention?: boolean;
}

export interface AuthorizeEvidenceAccessCommand {
  /** The MediaEvidence record being requested. */
  evidence: MediaEvidence;
  /**
   * Family ID of the requestor (extracted from session/token by the
   * application layer). Evidence is accessible only within its own family.
   */
  requestingFamilyId: FamilyId;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireChildInFamily(family: Family, childId: ChildId): void {
  const found = family.children.some((c) => c.childId === childId);
  if (!found) {
    throw new MediaDomainError(
      "CHILD_NOT_IN_FAMILY",
      `Child ${childId} does not belong to family ${family.familyId}`,
    );
  }
}

function iso8601AddDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Upload policy validation
// ---------------------------------------------------------------------------

export interface UploadPolicyViolation {
  code: string;
  message: string;
}

/**
 * Validates an upload request against the content-type and size policy.
 * Returns an array of violations (empty = valid). Called by the domain
 * layer before persisting the record, and may be called by the application
 * layer before accepting the object upload.
 */
export function validateUploadPolicy(
  kind: MediaKind,
  contentType: string,
  sizeBytes: number,
): UploadPolicyViolation[] {
  const violations: UploadPolicyViolation[] = [];

  const permitted = UPLOAD_PERMITTED_CONTENT_TYPES[kind];
  if (!permitted.includes(contentType)) {
    violations.push({
      code: "CONTENT_TYPE_NOT_PERMITTED",
      message: `content-type "${contentType}" is not permitted for ${kind}. Allowed: ${permitted.join(", ")}`,
    });
  }

  const maxBytes = UPLOAD_MAX_BYTES[kind];
  if (sizeBytes > maxBytes) {
    violations.push({
      code: "FILE_TOO_LARGE",
      message: `file size ${sizeBytes} bytes exceeds the ${kind} limit of ${maxBytes} bytes`,
    });
  }

  if (sizeBytes <= 0) {
    violations.push({
      code: "FILE_EMPTY",
      message: "file size must be greater than 0",
    });
  }

  return violations;
}

/** Convenience predicate. */
export function isValidUpload(
  kind: MediaKind,
  contentType: string,
  sizeBytes: number,
): boolean {
  return validateUploadPolicy(kind, contentType, sizeBytes).length === 0;
}

// ---------------------------------------------------------------------------
// Domain service functions
// ---------------------------------------------------------------------------

/**
 * Creates a `MediaEvidence` metadata record for a successfully uploaded
 * object. The caller (application layer) is responsible for:
 *   1. Receiving and writing the actual object to S3-compatible storage.
 *   2. Calling this function to produce the record.
 *   3. Persisting the record to PostgreSQL inside a transaction.
 *
 * Enforces:
 *   - Upload policy (content-type and size constraints).
 *   - Family isolation: childId must be a child member of `family`.
 *   - Retention schedule when `applyRetention` is true.
 *
 * @throws {MediaDomainError} with code:
 *   - `CHILD_NOT_IN_FAMILY` — childId not found in family
 *   - `CONTENT_TYPE_NOT_PERMITTED` — MIME type not allowed for the kind
 *   - `FILE_TOO_LARGE` — sizeBytes exceeds the kind's limit
 *   - `FILE_EMPTY` — sizeBytes ≤ 0
 *   - `STORAGE_KEY_EMPTY` — storageKey is blank
 */
export function registerEvidence(
  family: Family,
  command: RegisterEvidenceCommand,
): MediaEvidence {
  requireChildInFamily(family, command.childId);

  if (!command.storageKey.trim()) {
    throw new MediaDomainError("STORAGE_KEY_EMPTY", "storageKey must not be blank");
  }

  const violations = validateUploadPolicy(command.kind, command.contentType, command.sizeBytes);
  if (violations.length > 0) {
    const first = violations[0]!;
    throw new MediaDomainError(first.code, first.message);
  }

  const mediaEvidenceId = randomUUID() as MediaEvidenceId;
  const retentionExpiresAt =
    command.applyRetention
      ? iso8601AddDays(command.now, DEFAULT_RETENTION_DAYS)
      : undefined;

  return MediaEvidenceSchema.parse({
    mediaEvidenceId,
    familyId: command.familyId,
    childId: command.childId,
    kind: command.kind,
    storageKey: command.storageKey,
    contentType: command.contentType,
    sizeBytes: command.sizeBytes,
    uploadedAt: command.now,
    ...(retentionExpiresAt !== undefined ? { retentionExpiresAt } : {}),
  });
}

/**
 * Authorizes read access to an evidence record for a requesting party.
 * Evidence is family-private: only members of the owning family may read.
 *
 * @throws {MediaDomainError} with code:
 *   - `FAMILY_ISOLATION_VIOLATION` — requestingFamilyId ≠ evidence.familyId
 */
export function authorizeEvidenceAccess(
  command: AuthorizeEvidenceAccessCommand,
): MediaEvidence {
  if (command.evidence.familyId !== command.requestingFamilyId) {
    throw new MediaDomainError(
      "FAMILY_ISOLATION_VIOLATION",
      `Evidence ${command.evidence.mediaEvidenceId} belongs to family ` +
        `${command.evidence.familyId}; requesting family is ${command.requestingFamilyId}`,
    );
  }
  return command.evidence;
}

/**
 * Marks an evidence record as expired by setting `retentionExpiresAt` to
 * the current time (or earlier). Expired records should be scheduled for
 * deletion by a background job; the domain does not delete them directly.
 *
 * Idempotent: if `retentionExpiresAt` is already in the past, the record
 * is returned unchanged.
 */
export function expireEvidence(evidence: MediaEvidence, now: string): MediaEvidence {
  // Already expired — idempotent
  if (evidence.retentionExpiresAt && evidence.retentionExpiresAt <= now) {
    return evidence;
  }
  return MediaEvidenceSchema.parse({ ...evidence, retentionExpiresAt: now });
}
