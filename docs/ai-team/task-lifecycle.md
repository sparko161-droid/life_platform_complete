# Task Lifecycle

**Status:** Foundation

## State machine

BACKLOG → ANALYSIS → ARCHITECTURE_CHECK → READY → IN_PROGRESS → REVIEW → QA → SECURITY → ACCEPTANCE → DONE.

## Rework

REVIEW → REWORK → IN_PROGRESS.

Rework must name the failed acceptance criterion or contract.

## New work

REVIEW → PASS_WITH_DISCOVERIES → DISCOVERY_TRIAGE → NEW_TASK.

New tasks keep the source links and do not modify the historical scope of the original task.

## Blocked

Any state may move to ARCHITECTURE_BLOCKED, PRODUCT_BLOCKED, SECURITY_BLOCKED or DEPENDENCY_BLOCKED.

## Ownership

Every active task has one responsible executor, one reviewer and one gate owner.

## Parallelism

Independent tasks may run in parallel after contracts are frozen. Shared foundations are serialized where required.

## Merge rule

Only tasks with all mandatory gates passed may merge to the integration branch.
