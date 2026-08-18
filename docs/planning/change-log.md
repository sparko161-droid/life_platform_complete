# Planning Change Log

## 0.10 (P1-014 — task-to-reward vertical slice contract and event path)

- Added five OpenAPI operations to `services/api/openapi/openapi.yaml`
  implementing `docs/architecture/vertical-slice/task-to-reward.md`'s
  "Required commands": `GET /child/today` (`getChildToday`),
  `POST /task-assignments/{id}/start` (`startTaskAssignment`),
  `POST /task-assignments/{id}/approve` (`approveTaskCompletion`),
  `POST /task-assignments/{id}/reject` (`rejectTaskCompletion`),
  `POST /rewards/{id}/redeem` (`redeemReward`). `SubmitProof` was already
  `submitTaskCompletion` from P0-009 — not duplicated. All five carry the
  idempotency key per `docs/architecture/vertical-slice/api-and-events.md`'s
  "All commands require actor, family scope, authorization and idempotency
  key," widening `IdempotencyKey`'s doc comment beyond its original list.
- Added `ChildTodayView` schema — an aggregate read model, not a stored
  entity, built from current `TaskAssignment` rows. `streak` is optional
  because streak calculation is Progression's territory
  (`docs/game/progression.md`), not built by this task; disclosed as
  optional rather than given a fabricated default.
- Closed a real gap in `docs/planning/phases/phase-1.md`'s "event path":
  `packages/domain-types`'s `DOMAIN_EVENT_TYPES` was missing two of
  `task-to-reward.md`'s seven "Required events" —
  `PROGRESS_UPDATED` and `NOTIFICATION_REQUESTED`. Added both, with a
  completeness test asserting all seven required events exist rather than
  five of seven silently passing as "done."
- `packages/ux-contracts`'s action catalog (P1-009) now reflects reality:
  `task.attempt.start`, `task.approval.approve`, `task.approval.return`,
  `reward.redeem` flip from `SPECIFIED` to `IMPLEMENTED` with the real
  OpenAPI `operationId` attached; `task.evidence.submit` is corrected to
  `IMPLEMENTED` too (it was already built by P0-009, mis-scoped as
  `SPECIFIED` by P1-009). `task.publish` stays `SPECIFIED` — still P1-002's
  to build.
- Regenerated `packages/api-client/src/generated/openapi.d.ts`
  (`generate:check` passes).
- `contracts/registry.yaml`: `task` group to `0.3.0` (new `ChildTodayView`
  schema), `events` group to `0.3.0` (two new event types), `reward` and
  `ux_contracts` groups gain `P1-014` as a consumer.

## 0.9 (P1-009 — UI architecture, screen map and state/API contracts)

- New `packages/ux-contracts`: typed screen map (nine screens with a
  template-conformant `docs/ux/screens/*.md` contract), a UI-action →
  operation catalog scoped to those screens, and UI-state mappings for
  task assignment and reward status. This is Phase 1's "Contract gate"
  freeze point (`docs/planning/phases/phase-1.md`) for the vertical
  slice's UI-facing contracts.
- Wrote the missing `docs/ux/screens/parent-approvals.md` (`P-APPROVALS`)
  at the template-conformant tier — Phase 1's exit criterion requires
  "parent can approve" and no deep contract existed for that screen
  before this task, only the lighter `docs/ux/screens/10-parent-approvals.md`.
- `task-state.ts`/`reward-state.ts` disclose three real mismatches between
  `docs/ux/state-contracts.md`'s UI state machine and the backend
  `TaskAssignmentStatus`/`RewardStatus` enums (`packages/domain-types`)
  rather than pretending a 1:1 rename: `NOT_STARTED` has no assignment
  equivalent (`ASSIGNED`); UI `FAILED` isn't a real assignment status
  (derived from a `REJECTED` assignment plus its `VerificationResult`);
  UI `REWARD_PENDING` is client-synthesized from an `APPROVED` assignment
  with no `RewardLedgerEntry` yet, not a backend status of its own.
- Found and fixed a real bug while building this: `packages/domain-types`'s
  `package.json` had no `main`/`types`/`exports` fields, so no package
  could actually import it as a workspace dependency — nothing had tried
  until this task. Every other Phase 1 task that imports it
  (P1-001/P1-002/P1-005/P1-006) would have hit the same failure.
- Recorded two discoveries on P1-009 rather than silently resolving them:
  the domain-types gap above (`DISC-P1-009-2`), and a real inconsistency
  between two `docs/ux/screens/` ID schemes for overlapping screens
  (`DISC-P1-009-1`) — this task's contracts source from the
  template-conformant tier and leave the older numbered tier as-is rather
  than deleting content a human wrote without confirming intent.
- `contracts/registry.yaml` gets a `ux_contracts` group; validating it
  needed relaxing `task-registry contracts validate`'s FROZEN-group rule
  slightly — `defines.domain_types` is now required only when a group
  actually claims exports from a file there, since this group's frozen
  artifact is a separate package, not a `packages/domain-types/src/*.ts`
  file.

## 0.8 (P0-012 — docs/task traceability, Phase 0 complete)

- Added `scripts/check-docs-graph.mjs` (`pnpm run docs:check`, CI-wired):
  checks `docs/DOCS_GRAPH.md` against the real `docs/` tree in both
  directions (dead references, undocumented docs), and every
  `P<phase>-<NNN>` token in `docs/`/`tasks/`/`AGENTS.md` against real
  `tasks/registry.yaml` ids.
- Run cold before any fix: 74 real problems. Two dead references in
  `DOCS_GRAPH.md`; the other 72 were real docs never indexed, almost all
  from six entire sections (`engineering/`, `implementations/`,
  `governance/`, `learning/`, `platform/`, and most of `planning/`) that
  arrived during Phase 0 execution and were never added to the graph.
  Fixed `DOCS_GRAPH.md` directly rather than loosening the check.
- Added `task-registry decisions` (`registry.ts`'s `outstandingDecisions()`):
  implements `docs/planning/phases/phase-0.md`'s "Human Architect sees only
  unresolved decisions" exit criterion directly — lists `*_BLOCKED` tasks,
  unresolved `human_decisions`, and blocking `discovery_links`, and nothing
  else. Currently empty against the live registry, which is the correct,
  honest answer today.
- This closes the last of the twelve Phase 0 tasks (P0-001 through P0-012).
  `docs/engineering/phase-0-checklist.md` reflects the full set.

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
