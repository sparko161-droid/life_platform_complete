# Task Admission Rules

## Source of truth

The task lifecycle remains the source of truth for status transitions. This document adds admission requirements that must be satisfied before a task reaches `READY`.

## New task creation

A new task must have at least one traceable source:

- an approved roadmap requirement;
- a discovery attached to an existing task;
- a phase/wave plan item approved by the responsible Product/Architecture owner.

Discovery-driven work must preserve `origin_discovery` and `discovered_from`. A finding discovered during review must not silently enlarge the historical scope of its source task.

## Mandatory metadata before READY

- one primary executor;
- one independent reviewer;
- at least one gate owner;
- acceptance criteria;
- test strategy;
- `deps_contract`;
- `deps_implementation`;
- phase and wave assignment;
- priority;
- security/child-safety relevance where applicable;
- performance/scale relevance where applicable;
- contract/version references where the task consumes a frozen contract.

## Dependency admission

`deps_contract` means the upstream contract is sufficiently frozen and validated for parallel consumers.

`deps_implementation` means upstream runtime implementation must be `DONE` before integration or release.

A task may work against a frozen contract. It may not merge/integrate against an unfinished implementation dependency.

### Where each class is enforced

The two classes gate two different moments, which is the whole reason they
are separate fields rather than one `deps` list:

| Class | Gate | Enforced by |
| --- | --- | --- |
| `deps_contract` | starting work (`task-registry claim`, `task-registry next`) | `startBlockingDependencies()` / `claimableTasks()` |
| `deps_implementation` | offering work for integration (`task-registry handoff`, i.e. `IN_PROGRESS -> REVIEW`) | `integrationProblems()` |

`REVIEW` is used as the integration point because that is where work is
offered for merge -- the first moment the rule can bite without also
blocking the parallel contract-driven work the rule exists to permit.

A task at `READY` may not carry unclassified `deps`. The legacy `deps`
field still loads (registries written before this rule are not rejected
outright) and is treated as start-blocking, but `readyAdmissionProblems()`
refuses to admit a task that still uses it, which is what forces the
migration instead of letting both models coexist indefinitely.

## Blocking conditions

A task cannot become `READY` when:

- a blocking discovery remains unresolved;
- a required human decision is unresolved;
- required reviewer/gate ownership is missing;
- a breaking contract change has no ADR/explicit architecture decision;
- security/child-safety requirements are known but have no gate owner;
- required evidence from an upstream Wave Gate is failed or blocked.

## Scope control

If implementation discovers materially new work, the agent must:

1. record a discovery;
2. classify its impact and priority;
3. create a new traced task when scope expands;
4. stop/continue only according to the blocking flag and architecture/product decision.

## Dashboard behavior

The control dashboard must show readiness-rule violations and phase/wave gate status. It is informational; mutation remains through the task-registry CLI so all task changes are locked, validated and auditable.
