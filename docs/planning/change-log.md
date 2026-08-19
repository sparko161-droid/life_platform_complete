# Planning Change Log

## 0.20 (identity 0.2.0, openapi 0.4.0 — P1-031)

Two additive changes and one correction to work from the previous task.

- **openapi 0.3.0 → 0.4.0**: five identity operations (sign-up, consent,
  sign-in, sign-out, child provisioning). Nothing existing changed shape.
- **identity 0.1.0 → 0.2.0**: `Session.familyId` became optional and
  `isBootstrapSession` was added.

The correction is worth stating plainly, because it was a flaw in the
contract P1-029 froze one task earlier. `SessionSchema` required
`familyId`, which contradicted **ADR-0006's own constraint 3** — "parent
identity exists independently of, and prior to, family membership" — and
`family-service.ts`'s "createFamily: any authenticated parent (bootstraps
the family)". The practical effect: onboarding was impossible. No family
meant no session; no session meant no way to create a family.

`familyId` is now optional for PARENT sessions — a *bootstrap* session,
which may only create a family — and still required for CHILD, since a
child only ever exists inside one. Both the zod schema and the database
CHECK enforce that split.

Also in this task: `SessionGuard` switched from verifying a signed JWT to
resolving an opaque id against the `sessions` table. Until then P1-030's
revocation did not protect live traffic — a signature stays valid until it
expires, so a revoked parent kept working until their token aged out. The
JWT machinery (`signSessionToken`, `verifySessionToken`,
`SESSION_JWT_SECRET`, the `jsonwebtoken` dependency) was **deleted**
rather than kept: leaving a working token minter beside a system that no
longer trusts minted tokens invites reintroducing the same hole.

## 0.19 (contracts — P1-029, the Identity domain)

`docs/architecture/domain-map.md` has always listed Identity first and
said "Identity/Family → nearly all domains". P0-009's contract pack froze
Family/Task/Verification/Media/Reward and never covered it. This closes
that, and it is the first genuinely *new* domain added to the pack rather
than a revision of an existing one.

Found by P1-010 as "there is no login endpoint", then rescoped
(DISC-P1-010-1) once investigation showed the real shape: no Account,
Credential or Session entity existed anywhere; `family-service.ts` stated
the assumption in a comment — *"createFamily: any authenticated parent"* —
with nothing defining it; and `ParentId` was a branded UUID that
originated nowhere.

- New `identity` contract group at `0.1.0`: `Account`, `CredentialRecord`,
  `Session`, with classification maps and lifecycle transitions.
- Decisions recorded in **ADR-0006** (`docs/adr/0006-identity-and-session-model.md`):
  in-house identity with an `authProvider` seam; server-side session
  *records* rather than bearer-JWT-only; child access always
  parent-provisioned; Argon2id with the hash on a separate record from
  the aggregate that authorization reads.
- The parent/child asymmetry is enforced **by the schema**, not by
  convention: a `CHILD` session requires `issuedByParentId` and must not
  carry an `accountId`, because a `ChildProfile` has no credentials by
  contract and `data-architecture.md` requires child PII stay minimal.
- Server-side sessions are what make `family-lifecycle.md`'s existing
  promise — *"Revocation immediately invalidates protected access
  tokens/session grants"* — implementable at all. A stateless token is
  valid until expiry by construction.
- `SECRET` is used for the first time in this pack (`passwordHash`,
  `sessionId`), the class `data-classification.md` reserves for
  "credentials, tokens, keys and signing material".

`contract_pack_version` stays `0.2.0`: this is an additive new group, and
no existing schema changed shape.

Deliberately **not** included (packet D4, same line the API packet drew):
password reset, MFA, account recovery. `Account.consentAcceptedAt`
carries the consent *flag* only — the *policy* is a legal question owned
by P1-034, and per `docs/security/legal-ru.md` no compliance claim
follows from this work.

## 0.18 (openapi 0.3.0 — P1-028, from DISC-P1-026-1)

`services/api/openapi/openapi.yaml` gains one operation and bumps its own
`info.version` 0.2.0 → 0.3.0. Additive minor: no existing operation or
schema changed shape.

- **`publishTaskTemplate`** (`POST /task-templates/{id}/publish`,
  DRAFT → ACTIVE). Found by P1-026's e2e test, not by inspection:
  `createTaskTemplate` returns a DRAFT and `assignTask` requires an
  ACTIVE template, so the frozen contract could not reach past template
  creation — a client could never assign, start, submit, approve or
  redeem anything through the real API. Recorded as DISC-P1-026-1 and
  traced into P1-028 rather than patched silently.
- Fixed alongside it, surfaced by the same test: five POST transitions
  (`publish`, `start`, `approve`, `reject`, `redeem`) declare `200` in
  the spec but returned NestJS's default `201`. Handlers now carry
  `@HttpCode(200)`. Convention confirmed and now consistent: `201` for
  operations that create a resource, `200` for state transitions.
- `packages/api-client/src/generated` regenerated in the same change
  (CI's `generate:check` gate enforces this).
- The REST API surface is now version-tracked in
  `@life/versioning`'s `SURFACE_VERSION_STATUS`, deliberately independent
  of `contract_pack_version` (domain-types, unchanged at 0.2.0) — two
  separate versioned surfaces per
  docs/architecture/versioning-and-compatibility.md.

## 0.17 (contracts/registry.yaml — catch up six shipped domain-service groups)

`task-registry contracts validate` runs in CI (`pnpm run contracts:validate`,
wired into `.github/workflows/ci.yml`), but this branch never opened a pull
request until now -- CI only triggers on `pull_request`/`push` to `main`, so
nothing had actually run it since P1-002A. Every domain-service file added
since (`family-service.ts` P1-001, `task-service.ts` P1-002A,
`media-service.ts` P1-005, `reward-service.ts` P1-006, `idempotency.ts`
P1-008, `concurrency.ts` P1-015) shipped without a matching contract group,
and `family.ts`/`events.ts` gained exports (`InvitationToken*`,
`FAMILY_EVENT_TYPES`, `TASK_EVENT_TYPES`) their existing groups never
listed. None of this is a new shape change -- every export already exists
in code merged and gated `DONE` long before this entry. This is pure
registry catch-up:

- Six new FROZEN groups at version `0.1.0`: `family_service`,
  `task_service`, `media_service`, `reward_service`, `idempotency`,
  `concurrency`, each `defines.domain_types` pointing at its real file with
  every actual export listed.
- `family` group: added `INVITATION_STATUSES`, `InvitationStatus`,
  `InvitationTokenSchema`, `InvitationToken` (shipped with P1-001).
  Version stays `0.2.0` -- the shape didn't change, the registry's
  bookkeeping was just incomplete.
- `events` group: added `FAMILY_EVENT_TYPES`/`FamilyEventType`
  (P1-001), `TASK_EVENT_TYPES`/`TaskEventType` (P1-002A). Version stays
  `0.3.0` for the same reason.

`contract_pack_version` stays `0.2.0` -- no schema shape changed as part of
this entry, only what the registry indexes.

## 0.16 (P1-014 — record corrected to the scope actually delivered)

Raised in 0.12 and decided by the Human Architect: where a record does not
match reality, the record changes.

Checked what reality is. `services/api/src/index.ts` is still the Phase 0
placeholder, so nothing produces a reward ledger entry at all. But
`P1-014`'s own title is "first task-to-reward vertical slice **contract and
event path**", and what it delivered matches that exactly: five OpenAPI
operations, `DOMAIN_EVENT_TYPES` completed to the seven required events,
the UI action-to-operation mapping, and three contract-group version bumps.
Its handoff says in as many words that P1-015/P1-016 build the actual
server-side handlers and client wiring.

So `DONE` is the correct status for the scope this task had. What did not
match reality was the acceptance line, which 0.13 imported from
`tasks/phase-1-participant-matrix.yaml` -- "produces the correct reward
event and ledger entry exactly once" describes the runtime slice, not the
contract freeze, and that acceptance is already owned by P1-006
(append-only ledger, exactly-once identity), P1-008 (duplicate
completion/verification/reward), P1-015 (race/retry/conflict fixtures) and
P1-007 (the full journey). It was duplicated onto P1-014, not assigned to
it.

Corrected in both the registry (version 10 -> 11) and the participant
matrix: acceptance and test strategy now describe the contract freeze, and
the five implementation dependencies the matrix listed are removed --
a contract freeze does not depend on the implementations that will later
consume it. Status stays `DONE`.

## 0.15 (P1-020 / BLK-P1-011 — Wave Gates that can actually fail)

`docs/governance/wave-gate.md` already required "a versioned review
artifact records the result and follow-ups", and the artifact template
already existed. Neither was checkable. A wave could be marked `exit: PASS`
in `tasks/phase-1-status.yaml` with no review behind it at all, and a
review could claim a PASS while the tasks it scoped were still `PLANNED`.
Both directions are now closed.

- `tools/task-registry/src/control.ts`: schema for `tasks/reviews/W<N>.yaml`
  plus `validateControlPlane()`. A wave claiming an exit must have an
  artifact that decided PASS; an artifact claiming PASS must not be
  contradicted by task status or by a blocker that is still OPEN; every
  evidence area from the template must be accounted for; a PASS may not
  sit on top of a REWORK/BLOCKED area or architecture-control check.
- `task-registry control validate` + `pnpm run control:validate`, wired
  into CI next to `contracts:validate` and `docs:check`.
- Fixtures with deliberate drift (a PASS scoping a PLANNED task), missing
  evidence areas, an open blocker, and a wave with no artifact -- each
  asserted to fail. A validator nobody has watched fail is a validator
  nobody should trust.
- `NOT_REQUIRED` added as an architecture-control verdict. W0 has no
  migrations; answering PASS for a check nobody performed is the precise
  failure the artifact exists to prevent. It costs a mandatory note.
- New `task-registry admit <id>`: PLANNED -> READY, refusing any task
  `readyAdmissionProblems()` rejects. The rules existed and `validate`
  reported violations after the fact, but nothing enforced them at the
  moment of admission, and no CLI verb performed the transition at all.

`tasks/reviews/W0.yaml` is the first real artifact, and it decides
**REWORK**, not PASS: P1-013 and P1-020 are in REVIEW rather than DONE,
the independent Architecture Control review has not happened, and the
technical-debt area is REWORK (knip failures that pre-date this work, and
`handoff`'s comma-splitting of prose options). `control validate` would
have rejected a PASS anyway.

Verified: lint, typecheck, build, test (51 task-registry, 22 ux-contracts),
docs:check, contracts validate, registry validate, control validate.

## 0.14 (P1-013 / BLK-P1-001 — one canonical screen identity)

Two screen-ID schemes had been coexisting since P1-009 recorded the
discovery: the semantic ids code consumes (`C-TODAY`, `P-APPROVALS`) and
the positional ids in the earlier sketches (`UX-CHI-02`, `UX-PAR-04`). The
same screen had two names, so a reference from a test, an analytics event
or a ticket had no single resolution.

The semantic scheme is canonical (ADR-0005). It is the one code already
consumes; it is stable under insertion; and the positional scheme had
already failed on its own terms -- `11-parent-rewards.md` carried
`UX-PAR-05 / UX-CHI-06` for one screen, because a surface-partitioned
namespace cannot express a screen serving both surfaces.

- `packages/ux-contracts/src/screen-id-registry.ts`: `RETIRED_SCREEN_IDS`
  maps all 17 positional ids so old references still resolve;
  `SPECIFIED_SCREEN_IDS` names the eight screens that are canonically
  named but have no template-conformant contract yet, closing the window
  in which a screen could acquire a second identity;
  `resolveScreenId()` accepts either form.
- All 17 numbered documents migrated. The nine that duplicate a
  template-conformant contract were kept as product source but no longer
  declare an id -- they point at the contract instead, and the contract
  wins on conflict. Nothing a human wrote was deleted.
- The action catalog now covers the whole Phase 1 exit journey. The
  family/child rows of `docs/ux/action-api-catalog.md` were previously
  unrepresentable because `ActionContract.screen` was typed as `ScreenId`;
  it is now `CanonicalScreenId`, and `family.create`,
  `family.parent.invite` and `child.create` are registered as SPECIFIED
  against P1-001. Friend/chat/moderation/game rows stay out -- Phase 2+.
- Enforced by tests, not convention: every retired id resolves, the
  namespace has no duplicates, every document declares a canonical id and
  every canonical id is declared by exactly one document.
- `contracts/registry.yaml`: the `ux_contracts` group's open decision
  ("two screen-ID schemes exist") is closed.

Screen *boundaries* were not re-decided. Where the tiers disagreed about
chat and rewards being one screen or two, the template-conformant document
answered it explicitly and that answer was taken as-is.

Verified: lint, typecheck, build, test (22 ux-contracts, 45 task-registry),
docs:check, contracts validate, registry validate. `quality:dead-code`
(knip) still fails on pre-existing unused exports in `tools/task-registry`
-- unchanged by this work, and not introduced by it.

## 0.13 (W0 — Phase 1 admission metadata completed)

"Execute Phase 1 by priority" had no ordering to execute: 18 of the 24
Phase 1 tasks sat at `wave: UNASSIGNED` / `priority: P2` (the schema
defaults) with no reviewer, gate owners, acceptance criteria or test
strategy, even though `tasks/phase-1-participant-matrix.yaml` had all of
it. None of them could reach READY, because `readyAdmissionProblems()`
rejects exactly those gaps.

Registry migrated 9 -> 10 from the matrix. Every Phase 1 task now carries
wave, priority, primary, reviewer, gate owners, acceptance criteria, test
strategy and a source reference. Waves: W0 3, W1 1, W2 2, W3 3, W4 2,
W5 2, W6 5, W7 2, W8 4.

Three conflicts between the governance files had to be decided rather
than copied:

- **`P1-021` wave: W3 or W8?** `tasks/phase-1-control-tasks.yaml` said
  W3, the participant matrix said W8, and the registry had followed the
  former. `docs/planning/phase-1-execution-plan.md` lists "Security Red
  Team adversarial assessment and retest" under W8 and, separately,
  allows "red-team test design before runtime code is complete" to run in
  parallel earlier. The assessment is therefore W8; the control-tasks
  file was corrected to match, so all three sources now agree.
- **`P1-009` priority was `DONE`** in the matrix -- a status written into
  a priority field. Set to P0 from the execution plan's own "W0 ... P0 /
  BLOCKING" wave definition, and fixed in the matrix.
- **`P1-014` ownership was not overwritten.** The matrix plans
  `primary: backend-lead, reviewer: chief-architect`; the registry records
  `chief-architect` / `ai-cto`, who actually did and reviewed the work.
  A finished task's ownership is a historical record, not a plan, so the
  record stands and the divergence is noted here instead.

## 0.12 (BLK-P1-003 — contract vs implementation dependencies)

Closes the last W0 governance gap that existed only on paper:
`docs/governance/task-admission.md` had specified `deps_contract` /
`deps_implementation` since 0.11, and `tasks/phase-1-participant-matrix.yaml`
already classified all 24 Phase 1 tasks that way, but
`tools/task-registry` knew nothing about either field. Validation, claim
and handoff all still ran on the single undifferentiated `deps` list, so
the rule "a task may work against a frozen contract, but may not integrate
against an unfinished implementation" was unenforceable.

- `tools/task-registry/src/schema.ts`: added `deps_contract` and
  `deps_implementation`; `allDependencies()` for existence/cycle checks;
  `integrationProblems()` for the integration rule.
- `readyAdmissionProblems()` now refuses a READY task that still carries
  unclassified `deps`. The legacy field still *loads* (old registries are
  not rejected outright) and is treated as start-blocking, so nothing
  silently loosened during migration.
- `claimableTasks()`/`claim` gate on contract dependencies only;
  `handoff` (`IN_PROGRESS -> REVIEW`) gates on implementation
  dependencies. `next`/`list` print dependencies by class rather than
  flattening them back into one list.
- `tasks/registry.yaml` migrated (version 8 -> 9) from
  `tasks/phase-1-participant-matrix.yaml`, which is the authoritative
  classification. Two deliberate deviations from a straight copy:
  - **Union, never a silent drop.** The matrix omits dependencies the
    registry declared -- e.g. it would have dropped `P1-003`, `P1-004`,
    `P1-010` from `P1-007`'s dependencies and weakened `P1-008` from
    `P1-002B` to `P1-002A`. Those edges were kept, as implementation
    dependencies. Classifying a dependency is a metadata change; deleting
    one is a scope change and does not belong in this task.
  - **DONE tasks keep their real history.** `P1-014` is DONE, but the
    matrix lists `P1-001`, `P1-002A`, `P1-005`, `P1-006`, `P1-008` as its
    implementation dependencies -- all still PLANNED. Importing them would
    have retroactively produced a DONE task with unfinished dependencies.
    The matrix entry appears to describe the full task-to-reward slice
    (`P1-007`) rather than what `P1-014` actually delivered, which was the
    contract and event path. Left for the Human Architect: either the
    matrix entry for `P1-014` is over-broad, or `P1-014` was closed early.
    Recorded, not silently reconciled.
- Fixed a stale governance status found while triaging: `BLK-P1-005` was
  still `OPEN` although its split (`P1-002` -> `P1-002A`/`P1-002B`) had
  landed in 0.11 and every dependent had already been redirected.

Verified: `task-registry validate` (64 tasks), `contracts validate`,
45/45 task-registry tests.

## 0.11 (governance reconciliation — Wave Gate / Architecture Control Plane)

Reconciles `agent/phase-1-execution-governance` (PR #20, 33 commits, authored
independently while P1-009/P1-014 were in progress) onto `main` by hand
rather than a git merge — both branches rewrote overlapping regions of
`tools/task-registry/src/schema.ts`/`registry.ts` and `scripts/dashboard-server.mjs`.

- Added the full governance model: `docs/governance/{wave-gate,task-admission,phase-1-gates,phase-exit-decision,phase-review-cadence,security-red-team-protocol,architecture-control-plane}.md`,
  `docs/architecture/{architecture-control-plane,versioning-and-compatibility,phase-1-scale-guardrails}.md`,
  `docs/planning/{phase-1-execution-plan,phase-1-outcome-contract,phase-1-review-artifact-template}.md`.
  Gate hierarchy: `Task Gate -> Wave Gate -> Phase Architecture Control ->
  Phase Acceptance -> Human Architect Decision`.
- Added four new assurance roles (Architecture Control Lead, Security
  Engineering, Child Safety Lead, Security Red Team, Performance/Scale
  Agent) to `docs/ai-team/{agent-registry.yaml,roles.md,instructions/role-charters.md}`
  **alongside**, not instead of, the existing Security & Child Safety Agent
  role -- P0-008 and other DONE tasks already used it as primary, so it
  stays as the historical role for work that predates the split.
- `tools/task-registry/src/schema.ts`: added `execution` (wave, priority,
  acceptance_criteria, test_strategy, source_reference) to every task, and
  `readyAdmissionProblems()` -- checked by `validateStructure()` only for
  tasks at `READY`, so the 64-task registry didn't need every task
  populated, only the one that was actually `READY` (P1-013, migrated with
  real metadata matching `tasks/phase-1-participant-matrix.yaml`'s own
  entry for it).
- Found two more real bugs while reconciling, both fixed:
  1. The task-id regex (`/^P\d+-\d{3,}$/u`, from the governance branch)
     rejected the exact `P1-002A`/`P1-002B` ids that branch's own
     participant matrix defines. Widened to allow a trailing split-task
     letter; `scripts/check-docs-graph.mjs`'s task-id scanner and
     `readyAdmissionProblems` coverage got the same fix.
  2. `packages/domain-types`'s CI ordering bug (typecheck/test before
     build) was found and fixed in this same reconciliation pass, before
     this commit -- see 0.10's entry and the standalone `fix(ci)` commit.
- Executed BLK-P1-005 for real: retired `P1-002` (never claimed, nothing
  lost) and registered `P1-002A`/`P1-002B` in its place, redirecting every
  dependent task's `deps` and `contracts/registry.yaml`'s `consumed_by`
  entries from `P1-002` to `P1-002B` (which itself depends on `P1-002A`,
  so one redirected edge still means "the whole Task/Rules DSL is ready").
  Registered the five control/evolution/security/scale/evidence tasks
  `tasks/phase-1-control-tasks.yaml` already specified (P1-019..P1-023) as
  real `PLANNED` entries -- `docs:check` caught the drift (files
  referencing tasks that didn't exist in the registry) before this was
  done, which is exactly what that check exists for.
- `scripts/dashboard-server.mjs` gains `/control.html`, `/api/control.json`
  and file-watching for the three new `tasks/phase-1-*.yaml` control files,
  merged into the existing SSE-based server rather than replacing it.
  `/api/control.json`'s violations list reuses `readyAdmissionProblems()`
  from the built `tools/task-registry` output instead of duplicating the
  rule -- one source of truth for "what makes a READY task valid," checked
  by both the CLI and the dashboard.
- Updated `tasks/phase-1-blockers.yaml`: `BLK-P1-004` (independent
  reviewer/gates) and `BLK-P1-016` (migrate READY tasks) marked `RESOLVED`
  with evidence; `BLK-P1-002` (contract/API freeze) marked
  `PARTIALLY_RESOLVED` -- P1-009/P1-014 close it for the vertical-slice
  scope, Family/Task-DSL/Media operations beyond that are still open.
  `BLK-P1-001` (screen-ID reconciliation) stays `OPEN` -- P1-009 documented
  the discrepancy and chose a canonical tier for new work but did not
  merge/deprecate the older numbered tier.
- `docs/DOCS_GRAPH.md` gains a `## Governance` section and extends
  `Architecture / platform` and `Planning`.

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
