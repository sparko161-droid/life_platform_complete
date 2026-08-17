import { z } from "zod";
import { ChildId, FamilyId, MediaEvidenceId } from "./ids.js";
import type { ClassificationMap } from "./classification.js";

/**
 * Ownership: Media domain. Authorization: private by default —
 * "User-submitted photos/audio/video use private authorized access"
 * (docs/security/privacy.md). This record is metadata + a storage key,
 * never inline bytes: "Store metadata and storage keys in PostgreSQL;
 * objects live in S3-compatible storage. Use signed/authorized access."
 * (docs/architecture/data-architecture.md).
 * Events: referenced by VERIFICATION_COMPLETED via VerificationResult's
 * optional mediaEvidenceId (verification.ts); does not emit its own event
 * in docs/architecture/events.md's initial list.
 */
export const MEDIA_KINDS = ["PHOTO", "VIDEO", "AUDIO"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const MediaEvidenceSchema = z.object({
  mediaEvidenceId: MediaEvidenceId,
  familyId: FamilyId,
  childId: ChildId,
  kind: z.enum(MEDIA_KINDS),
  // Opaque key into S3-compatible storage; never a public URL. Access is
  // via a short-lived signed URL minted server-side per request.
  storageKey: z.string().min(1),
  contentType: z.string(),
  sizeBytes: z.number().int().positive(),
  uploadedAt: z.string().datetime(),
  // "Video by default is not sent to the server; the server receives the
  // verification result" (MASTER_SPEC §8) — retentionExpiresAt lets the
  // few strategies that do keep evidence (PHOTO_PROOF, VIDEO_PROOF,
  // AUDIO_PROOF) still be bounded rather than kept forever by default.
  retentionExpiresAt: z.string().datetime().optional(),
});
export type MediaEvidence = z.infer<typeof MediaEvidenceSchema>;

/** docs/security/data-classification.md: "child photos, voice and video
 * are CHILD_PRIVATE" is given as a worked example there verbatim. */
export const MEDIA_EVIDENCE_CLASSIFICATION: ClassificationMap<keyof MediaEvidence> = {
  mediaEvidenceId: "CHILD_PRIVATE",
  familyId: "FAMILY",
  childId: "CHILD_PRIVATE",
  kind: "CHILD_PRIVATE",
  storageKey: "CHILD_PRIVATE",
  contentType: "CHILD_PRIVATE",
  sizeBytes: "CHILD_PRIVATE",
  uploadedAt: "CHILD_PRIVATE",
  retentionExpiresAt: "CHILD_PRIVATE",
};
