# Phase 1 Execution Plan

**Status:** IN_PROGRESS  
**Phase 0:** COMPLETE  
**Phase 1 contract baseline:** COMPLETE  
**Phase 1 implementation:** NOT COMPLETE  
**Phase 1 exit:** BLOCKED

## Purpose

Phase 1 creates the Foundation Product Runtime: the reusable server-authoritative layer on which later phases add game, mobile, social, AI, integrations and community capabilities without rewriting core business truth.

The phase is intentionally broader than the first vertical slice. It must establish durable domain mechanisms, cross-cutting safety/quality mechanisms, evolution/versioning rules and the first evidence that all layers work together.

The authoritative result checklist is `docs/planning/phase-1-outcome-contract.md`.

## Non-negotiable Phase 1 exit

Phase 1 may be marked `DONE` only when the real runtime journey works without manual database edits:

`Parent A + Parent B -> Child -> Task Template -> Assignment -> Child Today -> Attempt -> Proof -> Parent Approval -> Exactly-once Reward Ledger -> Audit`

AND the phase outcome contract is proven by a complete evidence package.

## Execution waves

### W0 — Governance, contracts and admission control — P0 / BLOCKING

1. Reconcile the two screen-ID systems and freeze one canonical identity.
2. Freeze Phase 1 contract registry and operation/state/API traceability.
3. Separate `contract dependency` from `implementation dependency` in task semantics.
4. Require primary, independent reviewer, gate owners, acceptance criteria, test strategy and dependency classification before `READY`.
5. Split oversized Task/Rules work into independently reviewable units.
6. Resolve or explicitly reclassify historical discoveries.
7. Define phase/wave status evidence and Architecture Control artifacts.

**Wave exit:** contract baseline is frozen, task-admission rules are enforceable, ownership is complete and Wave Gate passes.

### W1 — Identity, Family and persistence foundation — P1 / CRITICAL

- Registration/auth boundary.
- Family lifecycle.
- Second-parent invitation.
- Child profile and capabilities.
- Family-scoped authorization.
- Real persistence/entities/migrations.
- Transaction boundaries and audit fields.

**Wave exit:** real application services execute the Family flow against real persistence; QA/security and Architecture Control confirm boundary integrity.

### W2 — Task and Rules runtime — P1 / CRITICAL

- Task template lifecycle.
- Assignment lifecycle and duplicate-assignment prevention.
- Rules DSL validation.
- Daily/weekly/custom schedules.
- Fixed daily tasks.
- Recurrence.
- Composite tasks.
- Deterministic state transitions.

**Wave exit:** a task can be created, validated, assigned and transitioned through its canonical lifecycle using server-authoritative rules.

### W3 — Evidence, Verification and Idempotency — P1 / CRITICAL

- Media evidence policy and storage references.
- Manual/parent-approval path.
- At least one media proof path.
- Verification state machine.
- Completion/verification retry semantics.
- Optimistic concurrency.
- Race/conflict fixtures.

**Wave exit:** completion and verification are safe under retry and concurrency, and evidence is permission-scoped.

### W4 — Reward and Event Foundation — P1 / CRITICAL

- Reward catalog/lifecycle.
- Append-only Reward Ledger.
- XP/Coins/Money semantics within Phase 1 scope.
- N-day reward rules required for Phase 1.
- Task -> verification -> approval -> reward event path.
- Exactly-once reward identity and deterministic replay behavior.

**Wave exit:** an approved completion creates the correct ledger effect exactly once and remains auditable.

### W5 — Evolution, Versioning and Scale Guardrails — P1 / FOUNDATION

- API/domain/event versioning policy.
- Persisted artifact/schema versioning for tasks/rules/rewards where required.
- Migration/version compatibility rules.
- Deprecation policy.
- Backward-compatible change checks.
- Feature-flag/controlled rollout mechanism for behavior that requires staged activation.
- Pagination/indexing guardrails.
- Critical query and N+1 checks.
- Concurrency hotspot inventory.
- Phase 2 scale-risk register with owners for unresolved risks.

**Wave exit:** future phases can evolve contracts/data without silently breaking historical state or downstream consumers, and known scale risks are explicit.

### W6 — Parent and Child Core UX — P1 / CRITICAL

- Parent task builder.
- Child Today/Task/Attempt/Result path.
- API/client wiring against real operations.
- Loading, empty, offline, conflict and retry states.
- Russian-only visible text enforcement.
- Child-appropriate UX gate.

**Wave exit:** parent and child can use the real backend path through the canonical UX journey.

### W7 — First End-to-End Vertical Slice — P0 / RELEASE CRITICAL

- Full family/task/proof/approval/reward journey.
- Automated E2E.
- Audit evidence.
- Real fixtures.
- Recovery/retry cases.

**Wave exit:** the first product loop is independently reproducible from a clean fixture/environment without manual DB edits.

### W8 — Cross-System Validation and Phase Exit — P0 / RELEASE BLOCKING

This wave is explicitly higher-level than task QA.

- Wave review artifacts W0-W7.
- Architecture Control review.
- Contract/API/event compatibility report.
- Security Engineering review.
- Security Red Team adversarial assessment and retest.
- Child Safety review.
- Performance/Scale guardrail review.
- Code-quality/duplication review.
- Documentation/task graph verification.
- Outstanding-decisions review.
- Technical-debt acceptance.
- Human Architect Go/No-Go decision.

**Wave exit:** every mandatory item in `docs/planning/phase-1-outcome-contract.md` is PASS or has an explicit Human Architect exception with owner, mitigation and expiry/revisit condition.

## Gate hierarchy

Every implementation unit uses task gates. Every completed wave uses a Wave Gate. Phase 1 has a separate Architecture Control Gate and final Phase Exit Gate.

`Task Gate -> Wave Gate -> Phase Architecture Control -> Phase Acceptance -> Human Architect Decision`

A higher-level gate does not replace a failed lower-level gate.

## Parallelization rules

### Can run in parallel

- Family and initial Task work after W0 contract freeze.
- Reward model/persistence work and Family work after stable contracts.
- QA fixture preparation while runtime implementation is underway.
- UX contract implementation after screen/API contracts are frozen.
- Security threat modeling and red-team test design before runtime code is complete.
- Scale guardrail analysis alongside domain implementation.

### Must remain sequential

- Contract reconciliation -> runtime implementation.
- Task lifecycle -> idempotency/event integration.
- Real backend operation -> frontend wiring for that operation.
- Backend + frontend slice -> E2E acceptance.
- W0-W7 completion -> W8 cross-system validation.
- W8 Architecture Control + security/red-team + acceptance -> Phase 1 exit.

## Phase 1 status model

`PLANNED -> BACKLOG -> ANALYSIS -> ARCHITECTURE_CHECK -> READY -> IN_PROGRESS -> REVIEW -> QA -> SECURITY -> ACCEPTANCE -> DONE`

Rework: `REVIEW/QA/SECURITY/ACCEPTANCE -> REWORK -> IN_PROGRESS`.

Discovery: `REVIEW -> PASS_WITH_DISCOVERIES -> DISCOVERY_TRIAGE -> NEW_TASK`.

A task cannot become `READY` unless it has:

- one primary executor;
- one independent reviewer;
- at least one gate owner;
- acceptance criteria;
- test strategy;
- explicit `deps_contract` and `deps_implementation` classification;
- no unresolved blocking discovery;
- no unresolved human decision that blocks the scope;
- traceable source/requirement.

New tasks start in `BACKLOG`, not `READY`.

## Review status is hierarchical

A task's `DONE` is not a wave's `DONE`. A wave's `DONE` is not a phase's `DONE`.

The project dashboard must display separately:

- task status;
- wave status;
- wave gate statuses;
- phase gate statuses;
- blockers;
- missing task-admission metadata;
- architecture-control result.

## Priority model

- **P0:** blocks phase integrity, phase exit or can invalidate downstream work.
- **P1:** essential reusable foundation or first vertical slice implementation.
- **P2:** quality/UX hardening that does not block the critical runtime path.
- **P3:** optional enhancement; must not delay Phase 1 exit.

## Phase 2 policy

Phase 2 implementation remains `WAIT`. No Phase 2 implementation task may be promoted to `READY` until Phase 1 exit passes. Contract/discovery work may proceed only when it does not consume Phase 1 critical-path capacity and is explicitly approved.
