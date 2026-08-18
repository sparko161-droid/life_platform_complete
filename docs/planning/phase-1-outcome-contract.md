# Phase 1 Outcome Contract

## Purpose

This document defines what the project must actually have at the end of Phase 1. Review, QA, security, architecture control and Human Architect acceptance must compare evidence against this contract. A phase is not complete because the planned tasks are merged.

## Required result

Phase 1 must deliver a reusable, server-authoritative foundation product runtime and one proven end-to-end family journey.

### Product capabilities

- Parent registration/authentication boundary exists and is enforceable server-side.
- Family is the security boundary for child data.
- Two parents can securely belong to and manage one family, including the second-parent invitation lifecycle.
- Child profile and parent capabilities/permissions are implemented and tested.
- Parent can create/edit/publish a task template.
- Task can be assigned to a child without duplicate assignment for the same logical schedule occurrence.
- Task supports the Phase 1 schedule/rule scope: daily, weekly, custom, fixed daily, recurring and composite behavior where declared in the Phase 1 contracts.
- Child can see the assigned task through the `Мой день -> Задание` journey.
- Child can start, submit proof and recover from transient failure states.
- At least two Phase 1 proof modes are real runtime paths; one must exercise media evidence and one must exercise a non-media or parent-approval path.
- Parent can approve or return a completion.
- Approved completion produces the correct reward exactly once.
- Reward history is auditable from the append-only ledger without manual DB edits.

## Reusable platform mechanisms that must exist

### Authorization
- Family-scoped authorization is enforced on the server.
- Parent capabilities are checked by canonical policy, not duplicated in clients.
- Child-facing operations cannot escalate into parent-only capabilities.

### State and events
- Canonical Task lifecycle is implemented as a server-authoritative state machine.
- Completion, verification, approval and reward transitions are represented by stable domain/application events where the architecture contract requires them.
- Consumers do not invent alternative authoritative states.

### Idempotency and concurrency
- Completion submission is idempotent.
- Verification/retry behavior is idempotent where side effects exist.
- Reward issuance is exactly-once from the perspective of the ledger.
- Optimistic concurrency/version checks prevent silent overwrites.
- Race fixtures prove duplicate completion/reward cannot be created by concurrent requests.

### Persistence
- Real Phase 1 tables/entities and migrations exist.
- Transactions cover operations that must change multiple authoritative records atomically.
- Migration up/down or equivalent supported rollback strategy is documented and tested in the development environment.

### Evidence and media
- Media is referenced by safe storage keys/IDs, not inline unbounded bytes or public URLs where prohibited by contract.
- Access to evidence is family/permission scoped.
- Retention and sensitive-data handling rules are implemented or explicitly gated by the Security/Child Safety review.

### Versioning and evolution

Phase 1 must establish the compatibility model used by later phases:

- API version is explicit.
- Domain contract version is explicit.
- Event payload/version evolution is explicit.
- Persisted task/rule/reward artifacts carry the schema/rules version required to interpret historical data.
- Database migrations are versioned.
- Breaking changes require an ADR or explicit architecture decision.
- Deprecation policy exists for API/events/contracts.
- Compatibility checks exist for changes that claim to be non-breaking.
- Feature flags or another controlled rollout mechanism exists for behavior that may need staged activation.

The requirement is not to build every future version in Phase 1. The requirement is that future versions can be introduced without silently invalidating existing authoritative data or downstream consumers.

### Observability and audit
- Correlation IDs and structured logs exist for the critical journey.
- Security-sensitive and reward-changing actions are auditable.
- Critical failures can be traced across API -> domain -> event -> reward boundaries.

### Performance and scale guardrails

Phase 1 does not need production-scale capacity testing, but it must establish safe architectural assumptions:

- pagination is used for unbounded histories/lists;
- indexes exist for critical lookup paths;
- no obvious N+1 or full-history scan is required by the critical journey;
- media does not transit unnecessarily through the primary database;
- event/async boundaries do not duplicate domain truth;
- concurrency hotspots are identified;
- expected Phase 2 load risks have an owner and follow-up task if not solved in Phase 1.

## Client result

Parent and child core screens use frozen screen contracts. The primary child journey is:

`Мой день -> Задание -> Выполнение -> Результат -> Мой день`

Each critical screen contract covers entry/exit, data, action, canonical operation, state transition, next navigation, error/empty/offline behavior and Russian-only visible text.

## Security result

Phase 1 must pass two independent security perspectives:

1. Security Engineering / Child Safety verifies the intended controls.
2. Security Red Team attempts to break them.

Red-team coverage must include at least family isolation, IDOR/authorization bypass, privilege escalation, replay/idempotency abuse, race conditions, media access, reward manipulation, input validation and information disclosure.

## Quality result

Required evidence includes:

- domain/unit tests;
- application/integration tests;
- negative/error tests;
- retry/idempotency tests;
- concurrency/race tests;
- end-to-end critical journey;
- security/red-team evidence;
- architecture-control review;
- documentation/task traceability checks.

## Architecture result

Phase 1 must leave a reusable foundation rather than a one-off demo. Later phases must be able to add games, mobile, social, AI and integrations by consuming stable contracts rather than rewriting the Family/Task/Verification/Reward core.

The Phase 1 Architecture Control Gate must confirm:

- no duplicate authoritative domain model was introduced;
- no client owns business truth;
- no later-phase concern leaked into Phase 1 core without an explicit boundary;
- contracts, code, events, database and docs tell the same story;
- versioning/evolution boundaries are explicit;
- known technical debt is registered with owners and does not silently become architecture.

## Evidence package required for acceptance

The Phase 1 acceptance package must contain:

- list of completed tasks and commits;
- wave review artifacts for W0-W8;
- final architecture-control review;
- API/contract compatibility report;
- migration report;
- automated test report;
- E2E journey evidence;
- security engineering report;
- red-team findings and retest results;
- child-safety review;
- performance/scale guardrail report;
- observability/audit evidence;
- documentation graph check;
- outstanding decisions report;
- list of accepted technical debt with owners;
- explicit Phase 1 Go/No-Go decision.

## Phase 1 acceptance rule

Every mandatory item above must be `PASS`, or have an explicit Human Architect decision with an owner, risk, mitigation and expiry/revisit condition. A phase cannot be marked `DONE` merely because every task is `DONE`.
