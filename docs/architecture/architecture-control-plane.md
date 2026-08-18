# Architecture Control Plane

## Purpose

The project is large enough that task-level review is insufficient to protect system integrity. The Architecture Control Plane is an independent control layer between implementation work and phase exit.

It does not replace the Chief Architect's architecture decisions. It independently checks that completed work still forms one coherent system across code, contracts, events, persistence, clients, tests and documentation.

## Control levels

### Task Gate
Checks one task: architecture, implementation, quality, QA, security, UX and acceptance as applicable.

### Wave Gate
Checks a coherent group of tasks as one system. Required before a wave is marked complete.

Wave review covers:
- cross-task interfaces and dependency direction;
- domain invariants and state machines;
- API/event/schema alignment;
- authorization boundaries and family isolation;
- migrations and transactional behavior;
- idempotency and concurrency assumptions;
- observability and auditability;
- contract and documentation traceability;
- compatibility/versioning impacts;
- test coverage across boundaries;
- code duplication and architecture drift;
- performance/scale guardrails relevant to the wave.

### Phase Architecture Gate
Runs after all required waves have passed and before phase acceptance. It answers: `does the completed phase still describe one coherent architecture and reusable foundation for later phases?`

The gate must inspect at minimum:
- authoritative product and architecture documents;
- domain model and bounded contexts;
- contracts and contract versions;
- event names, payload versions and consumers;
- database schema and migration history;
- API compatibility;
- dependency graph and layering;
- security and child-safety boundaries;
- feature flags and deprecation strategy;
- observability and operational assumptions;
- tests and evidence;
- documentation graph and task traceability;
- technical debt introduced during the phase.

## Independence

Architecture Control Lead must not be the primary implementer of the changes being assessed and must not be the sole reviewer of their own work. The Chief Architect remains responsible for durable architecture decisions and ADR approval. Architecture Control Lead is responsible for independent conformity and drift detection.

## Outputs

Every wave and phase review produces a versioned review artifact containing:
- scope and commits reviewed;
- contracts reviewed;
- tests/evidence reviewed;
- findings by severity;
- accepted deviations and their expiry/owner;
- architecture drift findings;
- documentation drift findings;
- security/red-team summary;
- performance/scale summary;
- go/no-go decision;
- follow-up task IDs.

## Stop rule

A failed Wave Gate blocks wave completion. A failed Phase Architecture Gate blocks phase exit. Exceptions require an explicit Human Architect decision and must be recorded; they must never be hidden by changing the historical task scope.
