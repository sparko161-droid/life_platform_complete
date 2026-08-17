# @life/domain-types

Phase 1 contract pack (P0-009, revalidated 0.2.0 — see
`docs/planning/change-log.md`). Zod schemas are the source of truth; TS
types are derived via `z.infer`, so validation and typing can never drift
apart.

## Entities

- `family.ts` — `Family` (aggregate root, `version` for optimistic
  concurrency), `ParentMembership` (capability-gated,
  `PENDING_INVITE → ACTIVE → SUSPENDED → ARCHIVED` family lifecycle),
  `ChildProfile` (minimal PII).
- `task.ts` — `TaskTemplate` (`DRAFT → ACTIVE → ARCHIVED`),
  `TaskAssignment` (`ASSIGNED → IN_PROGRESS → SUBMITTED → VERIFYING →
  APPROVED/REJECTED → COMPLETED → ARCHIVED`, matching
  `docs/architecture/entity-lifecycle.md`), `TaskCompletion` (immutable
  submission record).
- `verification.ts` — the 10 verification strategies from
  `docs/MASTER_SPEC.md` §8 and `VerificationResult`.
- `media.ts` — `MediaEvidence`: storage key + metadata only, never inline
  bytes or a public URL.
- `reward.ts` — `RewardLedgerEntry` (append-only, no balance field —
  `docs/architecture/data-architecture.md`) and `Reward` (catalog entity,
  `LOCKED → AVAILABLE → REDEEMING → REDEEMED/EXPIRED/CANCELLED` per
  `docs/architecture/entity-lifecycle.md`, types from
  `docs/game/rewards.md`).
- `events.ts` — the domain event envelope from
  `docs/architecture/events.md`.
- `ids.ts` — branded UUID types so e.g. a `ChildId` can't be passed where
  a `FamilyId` is expected.
- `classification.ts` — the `PUBLIC/FAMILY/CHILD_PRIVATE/PARENT_PRIVATE/
  SENSITIVE/SECRET` taxonomy from `docs/security/data-classification.md`.
  Every entity above ships a companion `<ENTITY>_CLASSIFICATION` map;
  `test/classification.test.ts` asserts every schema field has exactly
  one entry and vice versa.

## What this package does NOT resolve

Three blocking decisions from
`tasks/packets/P0-009-phase1-contract-pack.md` are flagged inline in the
affected schemas, not resolved: money policy (amount precision/currency),
the full parent role permission set, and child profile visibility rules.
Confirm with the Human Architect before P1-001/P1-002/P1-006 build on
them.

## Versioning

`CONTRACT_VERSION` (exported from `family.ts`) tracks the whole pack as
one unit. Bump it — and record why in `docs/planning/change-log.md` —
whenever a schema changes in a way downstream consumers need to know
about. Safe to revise in place while no Phase 1 implementation consumes
it yet; once real code depends on this, breaking changes need a new
version per `docs/architecture/api-contracts.md` ("Versioning").
