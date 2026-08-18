# Planning Change Log

## 0.7 (P0-011 — AI task orchestration)

- Added `task-registry next [--role][--limit]`: lists tasks claimable right
  now (`READY` with every dependency `DONE`), sorted by phase then id.
  Filter logic lives in `registry.ts`'s `claimableTasks()`, unit-tested
  independent of the CLI.
- Made every mutating `task-registry` command (`claim`, `handoff`, `block`,
  `unblock`, `reassign`, `add-discovery`, `create-child-task`, `close`)
  mutually exclusive via a real advisory file lock
  (`tools/task-registry/src/lock.ts`). Reproduced the race this fixes for
  real first: two concurrent `claim` calls on the same task both "succeeded"
  against an unlocked registry. Re-ran the same race after the fix — one
  succeeds, the other correctly fails with the single-primary-executor
  error.
- Found and fixed two more real bugs while building that lock, both
  documented in `docs/implementations/phase-0-ai-orchestration.md`: (1) the
  lock's own retry loop could busy-spin past its timeout instead of ever
  throwing, if a removal didn't immediately take effect; (2) Node's
  recursive `rmSync` silently fails to remove a directory under this repo's
  Cyrillic-containing path (`...\Работа\...`) on this machine's Node
  build — bisected with a bare, CLI-independent script — fixed by using
  `unlinkSync`+`rmdirSync` directly instead of the recursive helper.
- Also closed a process gap found while starting P0-010 (recorded there in
  0.6, restated here since it's what made P0-011 claimable at all): P0-001
  through P0-009 were merged to `main` but had never been walked through
  the `REVIEW -> QA -> SECURITY -> ACCEPTANCE -> DONE` gate sequence in
  `tasks/registry.yaml`.

## 0.6 (P0-010 — contract registry)

- Added `contracts/registry.yaml`: one entry per contract group (family,
  task, verification, media, reward, events, classification, plus a
  `PLANNED` `task_dsl` placeholder for the Rules DSL P1-002 hasn't built
  yet), each recording its version, owning role, exact `domain-types`
  exports, matching OpenAPI schema names, consuming tasks and open
  decisions. Satisfies `docs/planning/gap-backlog.md`'s P0 item.
- Added `task-registry contracts validate`
  (`tools/task-registry/src/contracts.ts`, `pnpm run contracts:validate`):
  cross-checks the registry against real `domain-types` exports, real
  `tasks/registry.yaml` ids and real change-log headings; flags both
  claimed-but-missing exports and real-but-unclaimed ones (orphans). Wired
  into CI as "Contract registry is in sync".
- `handoff` now archives its report to `tasks/handoffs/<id>.md` in addition
  to printing it, so a completed review survives past the terminal that ran
  it.
- Also closed a process gap found while starting this task: P0-001 through
  P0-009 had all been merged to `main` but were still sitting at `REVIEW`
  in `tasks/registry.yaml` — the QA/SECURITY/ACCEPTANCE gate transitions
  from `docs/engineering/merge-gate.md`'s "Post-merge: ... update task
  status" step had never actually been run. Walked all nine through
  `REVIEW -> QA -> SECURITY -> ACCEPTANCE -> DONE` before this task could
  even be claimed, since `claim` correctly refuses a task whose dependency
  isn't `DONE`.
- See `docs/architecture/contract-registry.md` for the full format and
  versioning policy.

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
