import { z } from "zod";

/**
 * Adversarial finding schema (P1-021).
 *
 * Backs BLK-P1-013's acceptance criterion: "every finding has severity and
 * retest result." A finding is only meaningful attached to a real exploit
 * attempt against real domain-types code, so `reference` always points at
 * the test in test/adversarial.test.ts that produced it -- this file
 * defines the shape, test/adversarial.test.ts is where the attacks
 * actually run.
 */

/** @public */
export const FINDING_CATEGORIES = [
  "AUTHORIZATION_IDOR",
  "FAMILY_ISOLATION",
  "PRIVILEGE_ESCALATION",
  "REPLAY",
  "RACE_CONDITION",
  "MEDIA_ACCESS",
  "REWARD_MANIPULATION",
  "INFORMATION_DISCLOSURE",
] as const;
/** @public */
export type FindingCategory = (typeof FINDING_CATEGORIES)[number];

/** @public */
export const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const;
/** @public */
export type Severity = (typeof SEVERITIES)[number];

/**
 * BLOCKED: the exploit was attempted against real domain-types code and
 * failed -- a control actually stopped it.
 * VULNERABLE: the exploit succeeded and nothing currently in this repo
 * would stop it in production.
 * ACCEPTED_RISK: the domain layer deliberately does not enforce this
 * control (pure-domain-layer design: no I/O, no persisted Family/session
 * to check against) and defers it to the application/API layer, which
 * does not exist yet (BLK-P1-007 is open). Distinguished from VULNERABLE
 * because the gap is a disclosed architectural boundary with a named
 * remediation owner, not an oversight -- but it still must be tracked and
 * retested once that layer exists, so it is not the same as BLOCKED
 * either.
 * @public
 */
export const FINDING_STATUSES = ["BLOCKED", "VULNERABLE", "ACCEPTED_RISK"] as const;
/** @public */
export type FindingStatus = (typeof FINDING_STATUSES)[number];

/** @public */
export const RETEST_RESULTS = ["PASS", "FAIL", "NOT_RETESTED"] as const;
/** @public */
export type RetestResult = (typeof RETEST_RESULTS)[number];

/** @public */
export const FindingSchema = z
  .object({
    id: z.string().regex(/^RT-\d{3}$/u, "id must look like RT-001"),
    category: z.enum(FINDING_CATEGORIES),
    severity: z.enum(SEVERITIES),
    title: z.string().min(1),
    exploitAttempt: z.string().min(1),
    actualOutcome: z.string().min(1),
    status: z.enum(FINDING_STATUSES),
    retestResult: z.enum(RETEST_RESULTS),
    /** Required when status is not BLOCKED -- a live gap or accepted risk always needs an owner and a fix path. */
    remediation: z.string().optional(),
    remediationOwner: z.string().optional(),
    /** The test in test/adversarial.test.ts that actually attempted this exploit. */
    reference: z.string().min(1),
  })
  .check((ctx) => {
    if (ctx.value.status !== "BLOCKED") {
      if (!ctx.value.remediation) {
        ctx.issues.push({ code: "custom", message: `${ctx.value.id}: status ${ctx.value.status} requires remediation`, input: ctx.value, path: ["remediation"] });
      }
      if (!ctx.value.remediationOwner) {
        ctx.issues.push({ code: "custom", message: `${ctx.value.id}: status ${ctx.value.status} requires remediationOwner`, input: ctx.value, path: ["remediationOwner"] });
      }
    }
  });
/** @public */
export type Finding = z.infer<typeof FindingSchema>;

/** @public */
export function validateFinding(candidate: unknown): string[] {
  const result = FindingSchema.safeParse(candidate);
  if (result.success) return [];
  return result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
}
