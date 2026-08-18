import { CONTRACT_VERSION } from "@life/domain-types";

/**
 * The versioned surfaces named by docs/architecture/versioning-and-compatibility.md
 * ("Versioned surfaces"), typed so the rest of this package -- and its
 * tests -- can reference them instead of re-typing the list as strings.
 * @public
 */
export const VERSIONED_SURFACES = [
  "rest-api",
  "domain-contracts",
  "domain-events",
  "persisted-artifacts",
  "database-schema",
  "ux-contracts",
] as const;
/** @public */
export type VersionedSurface = (typeof VERSIONED_SURFACES)[number];

/**
 * What "current version" honestly means for each surface today. Only
 * `domain-contracts` has an independently tracked semver
 * (`CONTRACT_VERSION` in packages/domain-types/src/family.ts). The others
 * do not have their own version number yet -- Phase 1's minimum scope
 * (docs/architecture/versioning-and-compatibility.md: "implement the
 * metadata, migration, compatibility and review mechanisms necessary to
 * introduce them safely later") is the mechanism, not fabricating numbers
 * for surfaces nothing tracks independently yet. `trackedVersion: null`
 * records that honestly instead of inventing a value.
 * @public
 */
export interface SurfaceVersionStatus {
  surface: VersionedSurface;
  trackedVersion: string | null;
  note: string;
}

/** @public */
export const SURFACE_VERSION_STATUS: readonly SurfaceVersionStatus[] = [
  {
    surface: "domain-contracts",
    trackedVersion: CONTRACT_VERSION,
    note: "Tracked via CONTRACT_VERSION (packages/domain-types/src/family.ts).",
  },
  {
    surface: "rest-api",
    trackedVersion: null,
    note: "No independent API version yet -- the 5 vertical-slice OpenAPI operations (P1-014) are unversioned. Real handlers land with the persistence/API layer (BLK-P1-007); version them then, not speculatively now.",
  },
  {
    surface: "domain-events",
    trackedVersion: null,
    note: "DOMAIN_EVENT_TYPES (packages/domain-types/src/events.ts) is additive-only so far -- every change to date has added a new event type, never removed or renamed one, so no breaking event-schema change has happened yet to version against.",
  },
  {
    surface: "persisted-artifacts",
    trackedVersion: null,
    note: "Persisted aggregates (Family/TaskTemplate/TaskAssignment/Reward) carry an optimistic-concurrency `version` field only -- that counts mutations, it is not a schema-shape version. No persistence layer exists yet (BLK-P1-007 is open); recorded as a known gap rather than silently bolted onto shipped schemas -- see this task's handoff.",
  },
  {
    surface: "database-schema",
    trackedVersion: null,
    note: "No database exists yet in this repo (BLK-P1-007 is open).",
  },
  {
    surface: "ux-contracts",
    trackedVersion: null,
    note: "packages/ux-contracts's SCREEN_IDS/ACTIONS are additive so far; no independent version number exists yet.",
  },
] as const;
