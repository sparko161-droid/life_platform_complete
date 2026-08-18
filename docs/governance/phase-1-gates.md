# Phase 1 Gates

## Gate chain

`Contracts -> Domain -> Persistence/API -> Verification/Reward -> UI -> E2E -> Security/Child Safety -> Architecture Revalidation -> Documentation -> Phase Exit`

A later gate cannot compensate for a failed earlier gate.

## Task gates

### Contract gate
- authoritative contract exists;
- version is frozen;
- operation/state/API mapping is traceable;
- no unresolved contract discovery is blocking the task.

### Implementation gate
- runtime behavior exists;
- persistence/transactions are real where required;
- authorization is enforced server-side;
- no placeholder implementation remains on the critical path.

### Test gate
- unit/domain tests;
- integration tests for application boundaries;
- negative/error cases;
- retry/idempotency/race cases where applicable.

### Security gate
- family isolation;
- role/capability enforcement;
- child-safety constraints;
- media/data classification and retention;
- no sensitive data leakage through logs/errors.

### Acceptance gate
- critical user journey works end-to-end;
- no manual database intervention;
- evidence is reproducible;
- observability/audit evidence exists.

## Phase 1 exit checklist

- [ ] Family lifecycle works.
- [ ] Second-parent invitation works.
- [ ] Child profile and capabilities work.
- [ ] Task template/lifecycle works.
- [ ] Rules/scheduling work for Phase 1 scope.
- [ ] Parent Task Builder works.
- [ ] Child Today/Task flow works.
- [ ] At least two proof modes work.
- [ ] Parent approval works.
- [ ] Reward ledger is append-only and exactly-once.
- [ ] Completion/verification/reward retries are idempotent.
- [ ] Optimistic concurrency/conflict handling is proven.
- [ ] Audit trail is reproducible.
- [ ] E2E journey passes.
- [ ] Security/child-safety gate passes.
- [ ] Architecture revalidation passes.
- [ ] Documentation/task graph is consistent.

## Status authority

`DONE` means all required evidence exists. A merged commit, passing typecheck, or completed contract alone is insufficient.

A task with an unresolved P0 blocker cannot be `READY`.

Phase 2 implementation remains blocked until this checklist is complete.
