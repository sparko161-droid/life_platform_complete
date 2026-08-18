import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { load } from "js-yaml";
import { z } from "zod";
import type { Registry } from "./schema.js";

/**
 * Wave Gate / Architecture Control artifact validation (P1-020,
 * BLK-P1-011).
 *
 * docs/governance/wave-gate.md already said a wave's completion "must be
 * validated as a system, not inferred from the statuses of its child
 * tasks", and docs/planning/phase-1-review-artifact-template.md already
 * described the review artifact. Neither was machine-checkable: a wave
 * could be marked PASS in tasks/phase-1-status.yaml with no review
 * artifact at all, and an artifact could claim a PASS while the tasks it
 * scoped were still PLANNED. This module closes both directions.
 *
 * The template is prose meant for humans; this is its checkable core --
 * scope, evidence, per-area verdicts and the decision -- as YAML under
 * tasks/reviews/. The two are intentionally not merged: reviewers write
 * the narrative, the tool checks the claims.
 */

/** @public Part of the control-plane public API; consumed by review tooling outside this package. */
export const GATE_VERDICTS = ["PASS", "REWORK", "BLOCKED"] as const;
/** @public */
export type GateVerdict = (typeof GATE_VERDICTS)[number];

/**
 * Evidence areas the review artifact template lists. A PASS must account
 * for every one of them -- that is what stops a review from passing by
 * saying nothing about security or migrations.
 * @public
 */
export const EVIDENCE_AREAS = [
  "contracts",
  "domain_state",
  "api",
  "events",
  "persistence_migrations",
  "tests",
  "security_engineering",
  "security_red_team",
  "child_safety",
  "performance_scale",
  "observability_audit",
  "documentation_traceability",
  "technical_debt",
] as const;
/** @public */
export type EvidenceArea = (typeof EVIDENCE_AREAS)[number];

/**
 * `NOT_REQUIRED` is a real answer, not a way to skip an area: it must
 * still carry a note saying why the area does not apply to this wave.
 */
const evidenceEntrySchema = z.object({
  area: z.enum(EVIDENCE_AREAS),
  status: z.enum(["PASS", "REWORK", "BLOCKED", "NOT_REQUIRED"]),
  evidence: z.string().default(""),
  note: z.string().default(""),
});

/**
 * The template offers PASS/REWORK/BLOCKED. `NOT_REQUIRED` is added
 * because an early wave has nothing to check for some of these -- W0 has
 * no migrations -- and answering PASS for a check nobody performed is
 * precisely the false claim this artifact exists to prevent. It costs an
 * explanation: `architecture_control_notes` must carry one for every
 * NOT_REQUIRED verdict.
 */
const architectureVerdictSchema = z.enum([...GATE_VERDICTS, "NOT_REQUIRED"]);

const architectureControlSchema = z.object({
  dependency_direction: architectureVerdictSchema,
  single_source_of_truth: architectureVerdictSchema,
  contract_version_compatibility: architectureVerdictSchema,
  migration_compatibility: architectureVerdictSchema,
  no_undocumented_breaking_changes: architectureVerdictSchema,
  no_duplicate_domain_implementation: architectureVerdictSchema,
  later_phase_concerns_bounded: architectureVerdictSchema,
});

const acceptedDeviationSchema = z.object({
  decision: z.string().min(1),
  risk: z.string().min(1),
  mitigation: z.string().min(1),
  owner: z.string().min(1),
  revisit: z.string().min(1),
  link: z.string().min(1),
});

/** @public Schema for parsing review artifacts outside this package (CI tooling, future dashboards). */
export const reviewArtifactSchema = z.object({
  version: z.number().int().positive(),
  review_id: z.string().min(1),
  scope: z.string().regex(/^(W\d|PHASE-1)$/u, "scope must be W0..W9 or PHASE-1"),
  reviewed_range: z.string().min(1),
  primary_reviewer: z.string().min(1),
  architecture_control_lead: z.string().min(1),
  /** Task ids this review actually covers. Never widened silently. */
  tasks: z.array(z.string()).default([]),
  evidence: z.array(evidenceEntrySchema).default([]),
  architecture_control: architectureControlSchema,
  /** Required explanation per NOT_REQUIRED architecture-control verdict. */
  architecture_control_notes: z.record(z.string(), z.string()).default({}),
  decision: z.enum(GATE_VERDICTS),
  accepted_deviations: z.array(acceptedDeviationSchema).default([]),
  follow_up_tasks: z.array(z.string()).default([]),
});
/** @public */
export type ReviewArtifact = z.infer<typeof reviewArtifactSchema>;

export interface ControlValidationOptions {
  /** tasks/reviews/ or a fixture directory. */
  reviewsDir: string;
  phaseStatusPath: string;
  blockersPath: string;
  taskRegistry: Registry;
}

interface WaveStatus {
  id: string;
  status: string;
  exit: string;
}

function loadWaves(phaseStatusPath: string): WaveStatus[] {
  const doc = load(readFileSync(phaseStatusPath, "utf8")) as {
    waves?: Array<{ id?: string; status?: string; exit?: string }>;
  };
  return (doc.waves ?? []).map((w) => ({
    id: String(w.id),
    status: String(w.status),
    exit: String(w.exit),
  }));
}

/**
 * Checks the review artifacts against the things they make claims about.
 * Returns human-readable problems; an empty array means the control plane
 * is internally consistent, not that Phase 1 is finished.
 *
 * Deliberately not checked here: whether the *prose* review happened. A
 * tool cannot verify that a human read the diff. It can verify that the
 * artifact exists, covers real tasks, accounts for every evidence area and
 * does not claim a PASS that the task registry contradicts -- which is
 * exactly the class of drift that made BLK-P1-011 a blocker.
 */
export function validateControlPlane(opts: ControlValidationOptions): string[] {
  const problems: string[] = [];
  const waves = loadWaves(opts.phaseStatusPath);
  const wavesById = new Map(waves.map((w) => [w.id, w]));
  const taskById = new Map(opts.taskRegistry.tasks.map((t) => [t.id, t]));

  const blockersDoc = load(readFileSync(opts.blockersPath, "utf8")) as {
    blockers?: Array<{ id?: string; status?: string; blocks?: unknown[] }>;
  };
  const openBlockers = (blockersDoc.blockers ?? []).filter((b) => String(b.status) === "OPEN");

  const artifacts = new Map<string, ReviewArtifact>();
  if (existsSync(opts.reviewsDir)) {
    for (const file of readdirSync(opts.reviewsDir)) {
      if (!file.endsWith(".yaml")) continue;
      const raw = load(readFileSync(resolve(opts.reviewsDir, file), "utf8"));
      const parsed = reviewArtifactSchema.safeParse(raw);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          problems.push(`${file}: ${issue.path.join(".")}: ${issue.message}`);
        }
        continue;
      }
      const artifact = parsed.data;
      if (artifacts.has(artifact.scope)) {
        problems.push(`${file}: a review artifact for ${artifact.scope} already exists`);
        continue;
      }
      artifacts.set(artifact.scope, artifact);

      if (artifact.scope !== "PHASE-1" && !wavesById.has(artifact.scope)) {
        problems.push(`${file}: scope ${artifact.scope} is not a wave in the phase status file`);
      }

      for (const id of [...artifact.tasks, ...artifact.follow_up_tasks]) {
        if (!taskById.has(id)) problems.push(`${file}: references unknown task ${id}`);
      }

      const covered = new Set(artifact.evidence.map((e) => e.area));
      for (const area of EVIDENCE_AREAS) {
        if (!covered.has(area)) problems.push(`${file}: evidence area "${area}" is not accounted for`);
      }
      for (const entry of artifact.evidence) {
        if (entry.status === "NOT_REQUIRED" && !entry.note) {
          problems.push(`${file}: "${entry.area}" is NOT_REQUIRED without a note saying why`);
        }
        if ((entry.status === "PASS" || entry.status === "REWORK") && !entry.evidence) {
          problems.push(`${file}: "${entry.area}" is ${entry.status} but cites no evidence`);
        }
      }

      if (artifact.decision === "PASS") {
        for (const entry of artifact.evidence) {
          if (entry.status === "REWORK" || entry.status === "BLOCKED") {
            problems.push(`${file}: decision is PASS but "${entry.area}" is ${entry.status}`);
          }
        }
        for (const [check, verdict] of Object.entries(artifact.architecture_control)) {
          if (verdict === "REWORK" || verdict === "BLOCKED") {
            problems.push(`${file}: decision is PASS but architecture control check "${check}" is ${verdict}`);
          }
        }
        for (const id of artifact.tasks) {
          const task = taskById.get(id);
          if (task && task.status !== "DONE") {
            problems.push(`${file}: decision is PASS but scoped task ${id} is ${task.status}, not DONE`);
          }
        }
        for (const blocker of openBlockers) {
          const blocks = (blocker.blocks ?? []).map(String);
          const hits = blocks.filter((b) => b === artifact.scope || artifact.tasks.includes(b));
          if (hits.length > 0) {
            problems.push(
              `${file}: decision is PASS but blocker ${blocker.id} is OPEN and blocks ${hits.join(", ")}`,
            );
          }
        }
      }

      for (const [check, verdict] of Object.entries(artifact.architecture_control)) {
        if (verdict === "NOT_REQUIRED" && !artifact.architecture_control_notes[check]) {
          problems.push(
            `${file}: architecture control check "${check}" is NOT_REQUIRED without a note in architecture_control_notes`,
          );
        }
      }

      if (artifact.accepted_deviations.length > 0 && artifact.decision === "BLOCKED") {
        problems.push(`${file}: a BLOCKED review cannot carry accepted deviations`);
      }
    }
  }

  // The other direction: a wave that claims to be finished must have the
  // artifact. This is the check that makes "wave status is independently
  // stored from task status" (wave-gate.md) safe rather than merely true.
  for (const wave of waves) {
    const artifact = artifacts.get(wave.id);
    const claimsDone = wave.status === "DONE" || wave.exit === "PASS";
    if (claimsDone && !artifact) {
      problems.push(`${wave.id}: status=${wave.status} exit=${wave.exit} but no review artifact exists`);
    }
    if (claimsDone && artifact && artifact.decision !== "PASS") {
      problems.push(`${wave.id}: claims exit=${wave.exit} but its review artifact decided ${artifact.decision}`);
    }
    if (!claimsDone && artifact?.decision === "PASS") {
      problems.push(
        `${wave.id}: review artifact decided PASS but the wave is still status=${wave.status} exit=${wave.exit}`,
      );
    }
  }

  return problems;
}
