import assert from "node:assert/strict";
import { test } from "node:test";
import { DATA_CLASSES } from "../src/classification.js";
import {
  ChildProfileSchema,
  CHILD_PROFILE_CLASSIFICATION,
  FamilySchema,
  FAMILY_CLASSIFICATION,
  ParentMembershipSchema,
  PARENT_MEMBERSHIP_CLASSIFICATION,
} from "../src/family.js";
import {
  MediaEvidenceSchema,
  MEDIA_EVIDENCE_CLASSIFICATION,
} from "../src/media.js";
import {
  RewardLedgerEntrySchema,
  REWARD_LEDGER_ENTRY_CLASSIFICATION,
  RewardSchema,
  REWARD_CLASSIFICATION,
} from "../src/reward.js";
import {
  TaskAssignmentSchema,
  TASK_ASSIGNMENT_CLASSIFICATION,
  TaskCompletionSchema,
  TASK_COMPLETION_CLASSIFICATION,
  TaskTemplateSchema,
  TASK_TEMPLATE_CLASSIFICATION,
} from "../src/task.js";
import {
  VerificationResultSchema,
  VERIFICATION_RESULT_CLASSIFICATION,
} from "../src/verification.js";

/**
 * docs/security/data-classification.md's acceptance criterion: "A
 * reviewer can identify the class ... for every new data field." This
 * makes that mechanically checkable instead of aspirational: every field
 * a zod schema declares must have exactly one classification entry, and
 * every classification entry must name a real field -- so the two can
 * never silently drift apart as either side is edited.
 */
const CASES: Array<{ name: string; schema: { shape: Record<string, unknown> }; classification: Record<string, string> }> = [
  { name: "Family", schema: FamilySchema.omit({ parents: true, children: true }), classification: FAMILY_CLASSIFICATION },
  { name: "ParentMembership", schema: ParentMembershipSchema, classification: PARENT_MEMBERSHIP_CLASSIFICATION },
  { name: "ChildProfile", schema: ChildProfileSchema, classification: CHILD_PROFILE_CLASSIFICATION },
  { name: "TaskTemplate", schema: TaskTemplateSchema, classification: TASK_TEMPLATE_CLASSIFICATION },
  { name: "TaskAssignment", schema: TaskAssignmentSchema, classification: TASK_ASSIGNMENT_CLASSIFICATION },
  { name: "TaskCompletion", schema: TaskCompletionSchema, classification: TASK_COMPLETION_CLASSIFICATION },
  { name: "VerificationResult", schema: VerificationResultSchema, classification: VERIFICATION_RESULT_CLASSIFICATION },
  { name: "MediaEvidence", schema: MediaEvidenceSchema, classification: MEDIA_EVIDENCE_CLASSIFICATION },
  { name: "RewardLedgerEntry", schema: RewardLedgerEntrySchema, classification: REWARD_LEDGER_ENTRY_CLASSIFICATION },
  { name: "Reward", schema: RewardSchema, classification: REWARD_CLASSIFICATION },
];

for (const { name, schema, classification } of CASES) {
  test(`${name}: every schema field has exactly one classification entry`, () => {
    const schemaKeys = new Set(Object.keys(schema.shape));
    const classificationKeys = new Set(Object.keys(classification));

    const missing = [...schemaKeys].filter((k) => !classificationKeys.has(k));
    const extra = [...classificationKeys].filter((k) => !schemaKeys.has(k));

    assert.deepEqual(missing, [], `${name} fields missing a classification: ${missing.join(", ")}`);
    assert.deepEqual(extra, [], `${name} classification entries for fields that don't exist: ${extra.join(", ")}`);
  });

  test(`${name}: every classification value is a real data class`, () => {
    for (const [field, cls] of Object.entries(classification)) {
      assert.ok(
        (DATA_CLASSES as readonly string[]).includes(cls),
        `${name}.${field} has invalid class "${cls}"`,
      );
    }
  });
}
