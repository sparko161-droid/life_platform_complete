/**
 * Controlled rollout / feature-flag evaluator (P1-019).
 *
 * Backs docs/architecture/versioning-and-compatibility.md rule 6:
 * "Feature flags or equivalent controlled rollout must be used where a
 * behavior change needs staged activation or rollback."
 *
 * Deliberately pure and storage-agnostic: this module defines what a flag
 * is and how it evaluates for a given subject, not where flag definitions
 * live (that is an application-layer concern once one exists -- Phase 1
 * has no running service to wire this into yet). A pure evaluator is also
 * what makes rollback trivial and safe: flipping `enabled: false` (or
 * removing a subject from `allowlist`) takes effect on the next
 * evaluation, with no migration or data change involved.
 */

/** @public */
export interface FeatureFlag {
  key: string;
  /** Master switch. false short-circuits every other rule -- always off, regardless of allowlist/rollout. */
  enabled: boolean;
  /** Subject ids always enabled, independent of the rollout percentage (e.g. internal test families). */
  allowlist?: readonly string[];
  /** Subject ids always disabled, independent of the rollout percentage and allowlist. Checked first. */
  denylist?: readonly string[];
  /**
   * 0-100. Deterministic per subject (same subjectId always evaluates the
   * same way for a given flag+percentage, so a family's experience does
   * not flicker between requests). Omitted/undefined means 100 (fully
   * rolled out once `enabled`).
   */
  rolloutPercentage?: number;
}

export interface FlagEvaluationContext {
  subjectId: string;
}

/**
 * FNV-1a, chosen only for being a small, dependency-free, well-distributed
 * non-cryptographic hash -- this is a rollout bucketing function, not a
 * security boundary.
 */
function hashToUnitInterval(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // >>> 0 forces an unsigned 32-bit value before normalizing to [0, 1).
  return (hash >>> 0) / 0xffffffff;
}

/**
 * Evaluates whether `flag` is on for `context.subjectId`. Precedence:
 * disabled flag -> off; denylisted subject -> off; allowlisted subject ->
 * on; otherwise -> on iff the subject's deterministic bucket falls within
 * `rolloutPercentage` (default 100, i.e. fully on once enabled).
 * @public
 */
export function evaluateFeatureFlag(flag: FeatureFlag, context: FlagEvaluationContext): boolean {
  if (!flag.enabled) return false;
  if (flag.denylist?.includes(context.subjectId)) return false;
  if (flag.allowlist?.includes(context.subjectId)) return true;

  const percentage = flag.rolloutPercentage ?? 100;
  if (percentage >= 100) return true;
  if (percentage <= 0) return false;

  const bucket = hashToUnitInterval(`${flag.key}:${context.subjectId}`) * 100;
  return bucket < percentage;
}
