import { z } from "zod";
import { VERSIONED_SURFACES } from "./surfaces.js";

/**
 * Deprecation registry (P1-019).
 *
 * Backs docs/architecture/versioning-and-compatibility.md rule 4:
 * "Deprecation must identify consumers, owner, target removal condition
 * and migration path." This is the schema that makes that a structural
 * requirement rather than a prose reminder -- an entry missing any of the
 * four cannot be constructed.
 *
 * `DEPRECATION_REGISTRY` starts empty: nothing in this Phase 1 contract
 * pack has been deprecated yet (every change to date has been additive --
 * see surfaces.ts's `SURFACE_VERSION_STATUS` notes). An empty registry is
 * the honest current state, not a gap; the mechanism this task delivers is
 * what future deprecations register against.
 */

/** @public */
export const DeprecationNoticeSchema = z.object({
  surface: z.enum(VERSIONED_SURFACES),
  /** What is being deprecated -- a field, event type, operation ID, screen ID, etc. */
  subject: z.string().min(1),
  /** Who relies on it today. */
  consumers: z.array(z.string().min(1)).min(1),
  /** Who owns the deprecation and its removal. */
  owner: z.string().min(1),
  /** The condition that must hold before removal is safe (not a bare date -- a checkable condition). */
  targetRemovalCondition: z.string().min(1),
  /** How a consumer migrates off the deprecated subject. */
  migrationPath: z.string().min(1),
  announcedAt: z.string().datetime(),
});
/** @public */
export type DeprecationNotice = z.infer<typeof DeprecationNoticeSchema>;

/**
 * Validates a candidate deprecation notice, returning the human-readable
 * zod issues rather than throwing -- callers (e.g. a future CI check over
 * a deprecations file) can report every problem in one pass.
 * @public
 */
export function validateDeprecationNotice(candidate: unknown): string[] {
  const result = DeprecationNoticeSchema.safeParse(candidate);
  if (result.success) return [];
  return result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
}

/**
 * The live deprecation registry. Empty today -- see module docstring.
 * @public
 */
export const DEPRECATION_REGISTRY: readonly DeprecationNotice[] = [] as const;
