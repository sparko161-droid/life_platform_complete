import { z } from "zod";

/**
 * Scale guardrail schema (P1-022).
 *
 * One entry per docs/architecture/phase-1-scale-guardrails.md "Mandatory
 * checks" bullet -- eight, no more, no fewer, matching the doc exactly so
 * a future edit to that doc can be diffed against this file.
 *
 * VERIFIED: checkable today against real code (no live database needed --
 * these are structural/domain-layer guarantees) and has a `reference` to
 * the test that checks it.
 * DEFERRED: cannot be verified without a persistence layer that does not
 * exist yet (BLK-P1-007 open). Requires `riskId` pointing at a
 * SCALE_RISK_REGISTER entry -- the doc's "Required evidence" section
 * requires every unsolved risk to have "an owner, reason and phase
 * target," so a DEFERRED guardrail with no registered risk is refused by
 * `validateGuardrail`, the same way an unexplained NOT_REQUIRED verdict is
 * refused in the wave-gate control plane (packages/domain-types is not
 * the only place in this repo that treats "not applicable" as a claim
 * that must be justified, not a way to skip a question).
 */
export const GUARDRAIL_STATUSES = ["VERIFIED", "DEFERRED", "NOT_APPLICABLE"] as const;
/** @public */
export type GuardrailStatus = (typeof GUARDRAIL_STATUSES)[number];

/** @public */
export const GuardrailSchema = z
  .object({
    id: z.string().regex(/^SG-\d{3}$/u, "id must look like SG-001"),
    check: z.string().min(1),
    status: z.enum(GUARDRAIL_STATUSES),
    evidence: z.string().min(1),
    /** The test in test/guardrails.test.ts (or elsewhere in the repo) that backs `evidence`. */
    reference: z.string().min(1),
    /** Required when status is DEFERRED: id of the matching SCALE_RISK_REGISTER entry. */
    riskId: z.string().optional(),
  })
  .check((ctx) => {
    if (ctx.value.status === "DEFERRED" && !ctx.value.riskId) {
      ctx.issues.push({
        code: "custom",
        message: `${ctx.value.id}: DEFERRED status requires riskId (see docs/architecture/phase-1-scale-guardrails.md "Required evidence")`,
        input: ctx.value,
        path: ["riskId"],
      });
    }
  });
/** @public */
export type Guardrail = z.infer<typeof GuardrailSchema>;

/** @public */
export function validateGuardrail(candidate: unknown): string[] {
  const result = GuardrailSchema.safeParse(candidate);
  if (result.success) return [];
  return result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
}

/**
 * Risk register entry (P1-022).
 *
 * docs/architecture/phase-1-scale-guardrails.md "Required evidence":
 * "Risks not solved in Phase 1 require an owner, reason and phase
 * target." Structural, not prose -- every field required.
 * @public
 */
export const ScaleRiskSchema = z.object({
  id: z.string().regex(/^SR-\d{3}$/u, "id must look like SR-001"),
  risk: z.string().min(1),
  owner: z.string().min(1),
  reason: z.string().min(1),
  phaseTarget: z.string().min(1),
});
/** @public */
export type ScaleRisk = z.infer<typeof ScaleRiskSchema>;

/** @public */
export function validateScaleRisk(candidate: unknown): string[] {
  const result = ScaleRiskSchema.safeParse(candidate);
  if (result.success) return [];
  return result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
}
