import { z } from "zod";
import { ChildId, MediaEvidenceId, TaskAssignmentId } from "./ids.js";
import type { ClassificationMap } from "./classification.js";

/**
 * Ownership: Verification Engine domain. `docs/MASTER_SPEC.md` §8:
 * "Task → Verification → Result → Event/Reward." Strategy list per
 * §8's "Initial strategies".
 */
export const VERIFICATION_STRATEGIES = [
  "MANUAL_SELF",
  "PARENT_APPROVAL",
  "PHOTO_PROOF",
  "VIDEO_PROOF",
  "CAMERA_EXERCISE",
  "TIMER",
  "COUNTER",
  "AUDIO_PROOF",
  "ALICE_SESSION",
  "COMPOSITE",
] as const;
export type VerificationStrategy = (typeof VERIFICATION_STRATEGIES)[number];

export const VERIFICATION_OUTCOMES = ["PASSED", "FAILED", "PENDING_REVIEW"] as const;
export type VerificationOutcome = (typeof VERIFICATION_OUTCOMES)[number];

/**
 * Authorization: written only by the Verification Engine (deterministic
 * for CAMERA_EXERCISE/TIMER/COUNTER; human-in-the-loop for
 * PARENT_APPROVAL) — never directly by a client. `docs/MASTER_SPEC.md`
 * §9: "deterministic ExerciseEngine → result... Raw exercise frames are
 * not stored by default", hence `mediaEvidenceId` is optional and, when
 * present, references an already-governed MediaEvidence record rather
 * than embedding any media/frame data here.
 * Events: emits VERIFICATION_COMPLETED (docs/architecture/events.md).
 */
export const VerificationResultSchema = z.object({
  taskAssignmentId: TaskAssignmentId,
  childId: ChildId,
  strategy: z.enum(VERIFICATION_STRATEGIES),
  outcome: z.enum(VERIFICATION_OUTCOMES),
  mediaEvidenceId: MediaEvidenceId.optional(),
  verifiedAt: z.string().datetime(),
  reviewedByParentId: z.string().optional(),
  notes: z.string().max(500).optional(),
});
export type VerificationResult = z.infer<typeof VerificationResultSchema>;

/** docs/security/data-classification.md: verification outcomes are child
 * progress records, scoped to the family (SENSITIVE would overclassify —
 * this isn't a safety/moderation record, just a normal task result). */
export const VERIFICATION_RESULT_CLASSIFICATION: ClassificationMap<keyof VerificationResult> = {
  taskAssignmentId: "CHILD_PRIVATE",
  childId: "CHILD_PRIVATE",
  strategy: "CHILD_PRIVATE",
  outcome: "CHILD_PRIVATE",
  mediaEvidenceId: "CHILD_PRIVATE",
  verifiedAt: "CHILD_PRIVATE",
  reviewedByParentId: "CHILD_PRIVATE",
  notes: "CHILD_PRIVATE",
};
