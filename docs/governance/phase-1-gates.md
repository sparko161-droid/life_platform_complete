# Phase 1 Gates

## Gate hierarchy

`Task Gate -> Wave Gate -> Phase Architecture Control -> Phase Acceptance -> Human Architect Decision`

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

### Security Engineering gate
- family isolation;
- role/capability enforcement;
- child-safety constraints;
- media/data classification and retention;
- no sensitive data leakage through logs/errors.

### Adversarial Security gate
Independently attempts to defeat the security model, including:
- IDOR and family isolation bypass;
- privilege escalation;
- session/replay abuse;
- race/idempotency abuse;
- media access abuse;
- reward/ledger manipulation;
- malformed input and information disclosure.

Findings require remediation and retest, or explicit Human Architect acceptance with risk/mitigation/expiry.

### Scale gate
- critical queries have appropriate indexes;
- pagination prevents unbounded reads;
- no obvious N+1 on critical journeys;
- concurrency hotspots are identified;
- media does not unnecessarily burden the primary database;
- unresolved scale risks have owners.

### Acceptance gate
- critical user journey works end-to-end;
- no manual database intervention;
- evidence is reproducible;
- observability/audit evidence exists.

## Wave Gate

Every Phase 1 wave must produce a review artifact. The Wave Gate checks the completed wave as one system rather than reviewing tasks independently.

Required checks:

- cross-task interfaces and dependency direction;
- API/domain/event/schema alignment;
- persistence and migration consistency;
- authorization boundaries;
- state machine coherence;
- idempotency and concurrency semantics;
- observability and auditability;
- compatibility/versioning impact;
- test coverage across task boundaries;
- duplicate abstractions and architecture drift;
- documentation/task traceability;
- security/red-team/scale findings relevant to the wave.

## Phase Architecture Control Gate

After W0-W7 and before final acceptance, `architecture-control-lead` independently checks:

- authoritative docs vs implementation;
- bounded domains and dependency direction;
- API/domain/event contracts and versions;
- database schema/migrations;
- client/backend separation of authority;
- feature flags and deprecation rules;
- security and child-safety boundaries;
- observability/operational assumptions;
- documentation graph;
- technical debt and accepted deviations;
- whether Phase 1 is a reusable foundation for later phases rather than a one-off vertical demo.

The result is `PASS`, `REWORK`, or `BLOCKED` and is stored as a versioned artifact.

## Phase 1 exit checklist

### Product
- [ ] Family lifecycle works.
- [ ] Second-parent invitation works.
- [ ] Child profile and capabilities work.
- [ ] Task template/lifecycle works.
- [ ] Rules/scheduling/recurrence/composite scope works.
- [ ] Parent Task Builder works.
- [ ] Child Today/Task/Attempt/Result flow works.
- [ ] At least two proof modes work.
- [ ] Parent approval/return works.
- [ ] Reward ledger is append-only and exactly-once.

### Platform mechanisms
- [ ] Completion/verification/reward retries are idempotent.
- [ ] Optimistic concurrency/conflict handling is proven.
- [ ] Real persistence and migrations exist.
- [ ] API/domain/event versioning rules are documented and exercised.
- [ ] Historical task/rule/reward data has an explicit compatibility strategy.
- [ ] Deprecation and controlled rollout/feature-flag strategy exists.
- [ ] Critical query/pagination/indexing/scale guardrails are proven.
- [ ] Observability/audit path is reproducible.

### Assurance
- [ ] Automated E2E journey passes.
- [ ] Security Engineering gate passes.
- [ ] Security Red Team assessment passes after retest.
- [ ] Child Safety gate passes.
- [ ] Performance/Scale gate passes.
- [ ] Wave Gates W0-W7 pass.
- [ ] Phase Architecture Control passes.
- [ ] Documentation/task graph is consistent.
- [ ] Outstanding decisions are resolved or explicitly accepted.

### Evidence package
- [ ] Task/commit inventory.
- [ ] Wave review artifacts.
- [ ] Architecture-control artifact.
- [ ] Contract/API/event compatibility report.
- [ ] Migration report.
- [ ] Automated test report.
- [ ] E2E report.
- [ ] Security and red-team reports including retest.
- [ ] Child-safety report.
- [ ] Scale guardrail report.
- [ ] Observability/audit evidence.
- [ ] Documentation graph check.
- [ ] Technical-debt register with owners.
- [ ] Human Architect Go/No-Go decision.

## Status authority

`DONE` means all required evidence exists. A merged commit, passing typecheck, or completed contract alone is insufficient.

A task with an unresolved P0 blocker cannot be `READY`.

A wave cannot be `DONE` until its Wave Gate passes.

A phase cannot be `DONE` until the Phase Architecture Control Gate and final acceptance gate pass.

Phase 2 implementation remains blocked until Phase 1 is complete.
