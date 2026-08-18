import { VERSIONED_SURFACES, type VersionedSurface } from "./surfaces.js";

/**
 * Per-surface breaking/non-breaking classification (P1-019).
 *
 * `checkSchemaCompatibility` (schema-compatibility.ts) mechanically
 * detects the common structural breakage classes for any zod object
 * schema. This module is the complementary, surface-specific catalog:
 * what counts as breaking for a surface that is not (only) a zod schema --
 * an event-type enum, a screen-ID namespace, a database column. Each rule
 * cites the concrete mechanism already enforcing or exercising it
 * elsewhere in the repo, so this stays a checkable claim, not a restated
 * policy.
 * @public
 */
export interface CompatibilityRule {
  surface: VersionedSurface;
  breakingExample: string;
  nonBreakingExample: string;
  reference: string;
}

/** @public */
export const COMPATIBILITY_RULES: readonly CompatibilityRule[] = [
  {
    surface: "domain-contracts",
    breakingExample: "Removing or renaming a required field on Family/TaskTemplate/TaskAssignment/Reward (e.g. dropping `version`).",
    nonBreakingExample: "Adding a new optional field, or a new value to an already-open enum.",
    reference: "checkSchemaCompatibility (schema-compatibility.ts) run against packages/domain-types's zod schemas.",
  },
  {
    surface: "domain-events",
    breakingExample: "Removing or renaming an entry in DOMAIN_EVENT_TYPES that a consumer already matches on.",
    nonBreakingExample: "Adding a new event type (done twice already: P1-001 added the 5 FAMILY_EVENT_TYPES, P1-014 added PROGRESS_UPDATED/NOTIFICATION_REQUESTED).",
    reference: "packages/domain-types/src/events.ts: DOMAIN_EVENT_TYPES.",
  },
  {
    surface: "rest-api",
    breakingExample: "Changing an existing operationId's request/response shape or removing an operation a client depends on.",
    nonBreakingExample: "Adding a new operation, or a new optional request field.",
    reference: "packages/ux-contracts's action catalog (P1-009/P1-014): operationId is the stable identity clients bind to.",
  },
  {
    surface: "ux-contracts",
    breakingExample: "Retiring a SCREEN_ID that a client still navigates to, without a redirect/alias.",
    nonBreakingExample: "Adding a new SCREEN_ID, or aliasing a retired one (RETIRED_SCREEN_IDS, see docs/adr/0005-canonical-screen-ids.md).",
    reference: "packages/ux-contracts/src/screen-id-registry.ts: RETIRED_SCREEN_IDS.",
  },
  {
    surface: "persisted-artifacts",
    breakingExample: "Changing how an already-persisted aggregate's stored shape is interpreted without a documented migration.",
    nonBreakingExample: "N/A yet -- no persistence layer exists in this repo (BLK-P1-007 is open); see surfaces.ts's SURFACE_VERSION_STATUS note for this surface.",
    reference: "tasks/phase-1-blockers.yaml: BLK-P1-007.",
  },
  {
    surface: "database-schema",
    breakingExample: "A migration that drops/renames a column or table still read by running code.",
    nonBreakingExample: "N/A yet -- no database exists in this repo (BLK-P1-007 is open).",
    reference: "tasks/phase-1-blockers.yaml: BLK-P1-007.",
  },
] as const;

/**
 * Every VERSIONED_SURFACES entry must have exactly one rule -- this is
 * what a completeness test asserts, mirroring the pattern already used by
 * CONFLICT_SCENARIOS (concurrency.ts) and IDEMPOTENCY_RULES (idempotency.ts)
 * in packages/domain-types.
 * @public
 */
export function coversAllSurfaces(rules: readonly CompatibilityRule[]): boolean {
  const covered = new Set(rules.map((r) => r.surface));
  return VERSIONED_SURFACES.every((s) => covered.has(s));
}
