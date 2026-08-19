# BLK-P1-006 / BLK-P1-007 — Real Persistence and API Layer

**Status:** ADOPTED — confirmed by Human Architect; created as P1-024/P1-025/P1-026/P1-027 in tasks/registry.yaml.
**Owner:** ai-cto
**Depends on:** P0-005 (OpenAPI/typed-client path), P0-009/0.2.0 contract pack, P1-001/P1-002A/P1-002B/P1-005/P1-006/P1-008/P1-014/P1-015/P1-019/P1-021/P1-022 (all DONE)
**Closes (once fully implemented and retested):** BLK-P1-006, BLK-P1-007, the remaining "require retest after fixes" half of BLK-P1-013, DISC-P1-021-1, DISC-P1-021-2

## Goal

Every remaining Phase 1 task (P1-003, P1-004, P1-007, P1-010, P1-011,
P1-016, P1-017, P1-018) is blocked on the same thing: a real running
backend. `services/api/src/index.ts` is still the Phase 0 placeholder.
This packet designs the persistence + API layer that unblocks all of
them, without writing implementation code yet — that is deliberate, per
current direction ("design/spec first, confirm before implementing").

## What already exists (nothing here is a new architectural decision unless flagged)

- **Stack is already fixed**: PostgreSQL (transactional source of truth),
  `node-pg-migrate` for migrations (chosen and *proven end-to-end* —
  `services/api/migrations/1735689600000_phase0-fixtures-smoke.js`, real
  up/down/up verified against local Postgres per
  `docs/architecture/data-architecture.md`), NestJS for the API
  (`docs/MASTER_SPEC.md`).
- **Contracts are already frozen**: every persisted shape
  (Family/ParentMembership/ChildProfile/TaskTemplate/TaskAssignment/
  TaskCompletion/VerificationResult/MediaEvidence/RewardLedgerEntry/Reward)
  exists as a zod schema in `packages/domain-types`, contract-registry
  tracked (`contracts/registry.yaml`).
- **Domain logic is already pure and tested**: every state transition
  (family-service.ts, task-service.ts, media-service.ts,
  reward-service.ts) is a `(state, command) -> {next, events}` function
  with 183+ passing tests. This packet's layer is a thin shell around
  that logic, not a reimplementation of it.
- **13 OpenAPI operations are already frozen** (`services/api/openapi/openapi.yaml`):
  `/families`, `/families/{id}`, `/families/{id}/children`,
  `/families/{id}/task-templates`, `/task-templates/{id}/assignments`,
  `/task-assignments/{id}`, `/task-assignments/{id}/completions`,
  `/task-assignments/{id}/start|approve|reject`,
  `/children/{id}/reward-ledger`, `/child/today`, `/rewards/{id}/redeem`.
- **Local infra already runs**: `docker-compose.dev.yml` (Postgres,
  Redis, MinIO), `pnpm dev:infra`, verified by P0-002/P0-007.
- **Two concrete gaps are already found and specced by the red-team
  assessment** (packages/security-red-team), not to be rediscovered:
  RT-002/RT-003/RT-005/RT-016 (actor authorization is unenforced — most
  seriously, a child can self-approve their own task) and RT-010
  (optimistic-version checks exist but nothing calls them). Both are
  acceptance criteria below, not optional hardening.

## What this packet decides (new)

1. **Repository shape**: no ORM. Hand-written repository classes/modules
   per aggregate, using the `pg` client directly with parameterized
   queries, one method per domain-service function's persistence need
   (load-by-id, save-with-version-check). Matches
   `docs/architecture/data-architecture.md`'s explicit "no query-building
   ORM has been chosen yet for Phase 1" and the migrations' own
   "no ORM lock-in" framing — this makes that the actual choice, not
   just an absence of one.
2. **Authorization enforcement point**: every mutating repository method
   that wraps a parent-facing domain function (`verifyTask`, `assignTask`,
   `publishTemplate`, `archiveTemplate`, `activateReward`,
   `confirmRedemption`, `cancelRedemption`, `expireReward`,
   `cancelReward`) loads the real `Family` aggregate first and verifies
   the session actor is an ACTIVE parent member with base access (or,
   for `verifyTask` specifically, that the actor is a parent — not the
   submitting child — or the literal `"system"` Verification Engine
   actor) before calling the domain function. This closes DISC-P1-021-1.
3. **Optimistic concurrency enforcement point**: every mutating
   repository method loads inside a single DB transaction, calls the
   matching `check*Version` function from `packages/domain-types`
   against the freshly-read row, and only then calls the domain function
   and writes — so a concurrent writer's stale version is caught by the
   application layer *and* by a DB-level `version` column check
   (`UPDATE ... WHERE version = $1`) as defense in depth. This closes
   DISC-P1-021-2.
4. **Session/auth mechanism** (**blocking decision — needs explicit
   sign-off, not assumed**): Phase 1's vertical slice needs *some* way to
   know which parent/child is making a request, but no scheme is
   documented yet beyond `docs/security/threat-model.md`'s generic "MFA
   for privileged accounts, token rotation." Recommendation: short-lived
   signed session token (JWT or opaque, NestJS Passport strategy) issued
   at a minimal login step, carrying `{actorId, familyId, role}`
   verified server-side on every request — never trusting a
   client-supplied `actorId` field in the request body (this is exactly
   what RT-002/003/005/016 exploit). Full auth (password reset, OAuth,
   MFA) is explicitly **out of scope** for this packet; only "a request
   is provably bound to one real actor" is in scope.

## Proposed task breakdown

Following the P1-002 → P1-002A/P1-002B precedent (BLK-P1-005: split an
oversized stream into independently reviewable units), not one
monolithic task:

| id (proposed) | title | primary | wave | deps_implementation | acceptance |
|---|---|---|---|---|---|
| P1-024 | Database schema, migrations and seed compatibility | backend-lead / devops-lead | W7 | P1-001, P1-002A, P1-002B, P1-005, P1-006 | Tables for every persisted aggregate match `packages/domain-types` schemas' shape; indexes match `phase-1-scale-guardrails.md` predicates (SG-002); `pnpm db:migrate:up`/`down`/`up` verified against real local Postgres; `packages/fixtures` seeds against the real schema, not ad-hoc `CREATE TABLE`. |
| P1-025 | Repository layer: persistence + authorization + concurrency enforcement | backend-lead | W7 | P1-024, P1-021 | Every domain-service function has a repository wrapper; RT-002/003/005/016 (authorization) and RT-010 (version enforcement) are retested and now BLOCKED, not ACCEPTED_RISK; `packages/security-red-team`'s suite re-run against the repository layer (not just the pure domain layer) as the new retest evidence. |
| P1-026 | Session/auth and the 13 frozen REST API handlers | backend-lead | W7 | P1-025 | Every operation in `services/api/openapi/openapi.yaml` has a real NestJS handler; a request's actor is derived from a verified session, never a client-supplied field; idempotency keys are enforced on every mutating endpoint per `docs/architecture/api-contracts.md`. |
| P1-027 | Vertical-slice E2E against the real stack | qa-lead | W7 | P1-026 | The full parent-creates-task → child-completes → proof → approval → reward journey runs against real Postgres with no manual DB intervention (closes BLK-P1-009's resolution text); this is also this packet's contribution toward P1-007. |

`P1-024`→`P1-025`→`P1-026`→`P1-027` is a hard sequential chain (each
genuinely needs the previous layer to exist) — not parallelizable the
way earlier Phase 1 domain packages were, because there is exactly one
database and one API surface, not independent aggregates.

## Acceptance (packet-level)

- BLK-P1-006 and BLK-P1-007 both close (not partially).
- BLK-P1-013's "require retest after fixes" clause closes: all 5
  ACCEPTED_RISK findings retested and reclassified.
- P1-003/P1-004/P1-010/P1-016/P1-011/P1-017/P1-018/P1-007 become
  actually unblocked in substance, not merely admittable by the
  dependency graph.

## Decisions confirmed

1. **Session/auth mechanism**: recommendation approved as-is (verified
   session token carrying `{actorId, familyId, role}`; exact JWT-vs-opaque
   and NestJS Passport-vs-hand-rolled choice deferred to P1-026's own
   implementation, not re-litigated here).
2. **Task boundaries**: the P1-024→P1-025→P1-026→P1-027 split approved
   and created as-is in `tasks/registry.yaml`.

## Parallel consumers

Frontend (P1-003, P1-004, P1-010), QA (P1-007, P1-011, P1-017), all of
Phase 2's game-engine work (`P2-001` depends on `P1-007`).
