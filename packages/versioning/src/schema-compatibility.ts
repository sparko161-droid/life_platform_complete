import type { z } from "zod";

/**
 * Generic backward-compatibility checker for zod object schemas (P1-019).
 *
 * Backs docs/architecture/versioning-and-compatibility.md's rule 5
 * ("Compatibility tests must run before a change is accepted as
 * non-breaking") with an actual mechanism instead of only a review
 * checklist: given the schema a consumer was built against and a
 * candidate new schema, this reports whether every value the consumer
 * could produce/accept under the old schema is still valid under the new
 * one.
 *
 * Deliberately scoped to the breakage classes that are both common and
 * mechanically detectable from zod's shape introspection alone:
 *
 *   - a field the old schema had is missing from the new schema
 *     (REMOVED_FIELD)
 *   - a field that used to be optional (or defaulted) is now required
 *     (FIELD_BECAME_REQUIRED)
 *   - a field the new schema added is required and has no default, so an
 *     old producer that never knew about it would fail to satisfy it
 *     (NEW_REQUIRED_FIELD_WITHOUT_DEFAULT)
 *
 * Deep type-narrowing within a field (e.g. a string enum losing a member)
 * is out of scope -- zod's shape introspection does not give a reliable,
 * general way to compare two arbitrary inner schemas for this without a
 * bespoke visitor per zod type. That is a known limitation, not a silent
 * gap: see the module-level test asserting what this function does and
 * does not catch.
 */

/** @public */
export const COMPATIBILITY_VIOLATION_CODES = [
  "REMOVED_FIELD",
  "FIELD_BECAME_REQUIRED",
  "NEW_REQUIRED_FIELD_WITHOUT_DEFAULT",
] as const;
/** @public */
export type CompatibilityViolationCode = (typeof COMPATIBILITY_VIOLATION_CODES)[number];

/** @public */
export interface CompatibilityViolation {
  code: CompatibilityViolationCode;
  field: string;
  message: string;
}

/** @public */
export interface CompatibilityReport {
  compatible: boolean;
  violations: CompatibilityViolation[];
}

/**
 * Compares an old and a new zod object schema and reports whether the new
 * one is backward-compatible with the old one, i.e. safe to treat as a
 * non-breaking change per docs/architecture/versioning-and-compatibility.md
 * rule 1.
 * @public
 */
export function checkSchemaCompatibility(
  oldSchema: z.ZodObject<z.ZodRawShape>,
  newSchema: z.ZodObject<z.ZodRawShape>,
): CompatibilityReport {
  const violations: CompatibilityViolation[] = [];
  const oldShape = oldSchema.shape as Record<string, z.ZodTypeAny>;
  const newShape = newSchema.shape as Record<string, z.ZodTypeAny>;

  for (const [field, oldField] of Object.entries(oldShape)) {
    const newField = newShape[field];
    if (!newField) {
      violations.push({
        code: "REMOVED_FIELD",
        field,
        message: `Field "${field}" existed in the old schema and is missing from the new one.`,
      });
      continue;
    }
    const wasOptional = oldField.isOptional();
    const isNowOptional = newField.isOptional();
    if (wasOptional && !isNowOptional) {
      violations.push({
        code: "FIELD_BECAME_REQUIRED",
        field,
        message: `Field "${field}" was optional (or defaulted) and is now required -- a producer that omitted it will now fail validation.`,
      });
    }
  }

  for (const [field, newField] of Object.entries(newShape)) {
    if (field in oldShape) continue;
    if (!newField.isOptional()) {
      violations.push({
        code: "NEW_REQUIRED_FIELD_WITHOUT_DEFAULT",
        field,
        message: `Field "${field}" is new, required, and has no default -- an old producer that never knew about it cannot satisfy it.`,
      });
    }
  }

  return { compatible: violations.length === 0, violations };
}
