# Phase 1 Execution Plan

**Status:** IN_PROGRESS  
**Phase 0:** COMPLETE  
**Phase 1 contract baseline:** COMPLETE  
**Phase 1 implementation:** NOT COMPLETE  
**Phase 1 exit:** BLOCKED

## Purpose

This document is the execution baseline for Phase 1 after the independent implementation audit. It supersedes informal sequencing and makes the critical path, ownership, review, gates and blockers explicit.

## Non-negotiable Phase 1 exit

Phase 1 may be marked `DONE` only when the following real runtime journey works without manual database edits:

`Parent A + Parent B -> Child -> Task Template -> Assignment -> Child Today -> Attempt -> Proof -> Parent Approval -> Exactly-once Reward Ledger -> Audit`

The exit evidence must cover authorization, family isolation, state transitions, idempotency, optimistic concurrency, reward duplication prevention, recovery states, QA, security/child-safety and documentation traceability.

## Execution waves

### W0 — Governance and contract repair — P0 / BLOCKING

1. Reconcile the two screen-ID systems. Canonical IDs must be selected before frontend implementation.
2. Freeze the Phase 1 contract registry and operation-to-API traceability.
3. Separate `contract dependency` from `implementation dependency` in task semantics. A frozen contract may unblock contract consumers; integration still requires the implementation dependency to be `DONE`.
4. Assign reviewer and gate owners to every Phase 1 task before it can become `READY`.
5. Split the oversized Task/Rules work into independently reviewable implementation units.
6. Mark historical `domain-types` discovery as resolved if the package exports are now validated; do not leave a completed task carrying a stale active blocker.

**Exit:** contracts are frozen, ownership is complete, dependency semantics are explicit, and no stale blocking discovery remains.

### W1 — Domain and persistence foundation — P1 / CRITICAL

Parallel where contracts permit:

- Family lifecycle and second-parent invitation.
- Task template/lifecycle core.
- Persistence/migrations for Phase 1 entities.
- Rules DSL validation model.
- Reward ledger persistence contract.

**Exit:** domain operations can be executed through real application services and persisted transactionally.

### W2 — Verification, idempotency and event path — P1 / CRITICAL

- Media evidence storage/upload policy.
- Attempt/completion lifecycle.
- Verification strategies required by Phase 1.
- Exactly-once completion and reward fixtures.
- Conflict/optimistic-concurrency handling.
- Task -> verification -> approval -> reward event path.

**Exit:** the backend can complete the core lifecycle safely under retry and conflict.

### W3 — Product UI vertical slice — P1 / CRITICAL

- Parent task builder.
- Child Today/Task screens.
- Final screen contracts and action/API traceability.
- API/client wiring.
- Loading, error, retry and recovery states.

**Exit:** parent and child can execute the full journey through the UI.

### W4 — Quality and acceptance — P0 / RELEASE BLOCKING

- Automated E2E journey.
- Security and child-safety gates.
- Domain/source-of-truth revalidation.
- Observability and audit evidence.
- Documentation/task traceability.

**Exit:** Phase 1 acceptance criteria are proven by evidence.

## Parallelization rules

### Can run in parallel

- Family and Task domain work after W0 contract gate.
- Reward ledger implementation and Family implementation after frozen contracts.
- UX work after the relevant screen/API contracts are frozen.
- QA fixture preparation while implementation is underway.

### Must remain sequential

- Contract reconciliation -> implementation.
- Task lifecycle -> idempotency fixtures.
- Backend event path -> frontend API wiring for that path.
- Backend + frontend vertical slice -> E2E acceptance.
- E2E + security + architecture revalidation -> Phase 1 exit.

## Phase 1 status model

`PLANNED -> READY -> IN_PROGRESS -> REVIEW -> QA -> ACCEPTANCE -> DONE`

A task cannot become `READY` unless it has:

- one primary executor;
- one independent reviewer;
- at least one gate owner;
- dependencies classified as contract or implementation dependencies;
- acceptance criteria;
- test strategy;
- known blockers/discoveries linked.

`DONE` is evidence-driven. A merge alone does not make a task `DONE`.

## Priority model

- **P0:** blocks the Phase 1 critical path or can invalidate downstream work.
- **P1:** critical implementation work required for the first vertical slice.
- **P2:** quality/UX hardening that does not block backend progress.
- **P3:** optional enhancement; must not delay Phase 1 exit.

## Phase 2 policy

Phase 2 remains `WAIT`. No Phase 2 implementation task may be promoted to `READY` until Phase 1 exit passes, except explicitly approved contract/discovery work that does not consume the Phase 1 critical-path capacity.
