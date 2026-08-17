# Planning Change Log

## 0.5 (contracts/v0.2.0 — P0-009 revalidation)

Triggered by `docs/governance/project-evolution.md`'s mandatory
revalidation point ("After Phase 0: inspect the real AI workspace, Git
flow, CI, gates and handoffs") — several architecture docs
(`entity-lifecycle.md`, `data-classification.md`, `docs/game/rewards.md`,
`concurrency-and-conflicts.md`) landed *after* the 0.1.0 contract pack was
written, during a large concurrent documentation wave. Compared the real
contract against them and fixed the gaps rather than filing a Discovery
and leaving them:

- `TaskAssignment.status` extended to the canonical
  `ASSIGNED → IN_PROGRESS → SUBMITTED → VERIFYING → APPROVED/REJECTED →
  COMPLETED → ARCHIVED` from `entity-lifecycle.md`'s "## Task" section
  (was missing VERIFYING/COMPLETED/ARCHIVED).
- `TaskTemplate.isActive: boolean` replaced with
  `status: DRAFT | ACTIVE | ARCHIVED` (entity-lifecycle.md's default
  pattern; a boolean can't represent DRAFT).
- New `Reward` catalog entity (`LOCKED → AVAILABLE → REDEEMING →
  REDEEMED`, alternative terminals `EXPIRED`/`CANCELLED`) with the full
  type list from `docs/game/rewards.md`
  (XP/COINS/MONEY/SCREEN_TIME/DEVICE_TIME/COUPON/ACTIVITY/FAMILY/CUSTOM),
  distinct from the existing `RewardLedgerEntry` (currency movement only).
  `RewardLedgerEntry` gained `sourceRewardId` to link redemptions back to
  the catalog entry.
- `version` (optimistic-concurrency token) added to `Family`,
  `TaskTemplate`, `TaskAssignment` and `Reward` per
  `concurrency-and-conflicts.md` ("Use optimistic version checks for
  mutable aggregates").
- Every schema now ships a companion data-classification map
  (`packages/domain-types/src/classification.ts`) satisfying
  `data-classification.md`'s acceptance criterion; a generic test asserts
  every schema field has exactly one classification entry and vice versa,
  so the two can't silently drift.
- `docs/architecture/api-contracts.md` got the "Generation pipeline"
  section that should have shipped with 0.1.0/P0-005 but didn't; CI now
  runs `generate:check` for real (previously written but never wired in).
- Safe to revise in place rather than deprecate-and-reissue: this is a
  contract, not yet consumed by running Phase 1 code.

## 0.4 (contracts/v0.1.0 — P0-009)

- Froze the Phase 1 contract pack: `packages/domain-types` (Family,
  ParentMembership, ChildProfile, TaskTemplate, TaskAssignment,
  TaskCompletion, VerificationResult, MediaEvidence, RewardLedgerEntry,
  domain event envelope) and matching OpenAPI schemas/paths in
  `services/api/openapi/openapi.yaml`.
- Each entity documents ownership, authorization, emitted events and a
  disclosed version (0.1.0); test fixtures per entity in
  `packages/domain-types/test/`.
- Blocking decisions from `tasks/packets/P0-009-phase1-contract-pack.md`
  (money policy precision/currency, parent role permission set, child
  profile visibility) are NOT resolved here — flagged inline in the
  affected schemas for Human Architect confirmation before P1-001/P1-002/
  P1-006 build on them.
- Downstream consumers (P1-001, P1-002, P1-005, P1-006 per
  `tasks/registry.yaml`) should treat this as the frozen contract per
  `docs/planning/phase-handoff.md` ("A downstream stream may start
  against a frozen contract. Breaking changes require a new version...").

## 0.3

- Added Discovery/Rework/New Task policy.
- Added detailed phase documents 0-7.
- Added parallel workstream map and dependency graph.
- Added responsibility matrix.
- Added implementation map.
- Added end-to-end product cases.
- Added Phase 0 task packets and machine-readable registry.
- Clarified no silent scope expansion.
