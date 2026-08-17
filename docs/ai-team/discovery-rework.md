# Discovery, Rework and New Work Policy

**Status:** Foundation
**Owner:** AI CTO

## Purpose

Reviews must distinguish a defect in agreed scope from newly discovered work. This prevents endless rewriting of a closed scope and preserves traceability.

## Four outcomes

- PASS — scope is correct; no new work.
- PASS_WITH_DISCOVERIES — scope is correct; additional work is recorded as discoveries and new tasks.
- REWORK — implementation violates agreed scope, contract or acceptance criteria.
- BLOCKED — implementation cannot proceed without a decision or dependency.

## Discovery

A reviewer creates a Discovery when work is outside the current accepted scope or a new dependency/gap is found.

Required fields:

- discovery_id
- source_task
- type
- finding
- why_it_matters
- affected_domains
- architecture_impact
- security_impact
- ux_impact
- recommended_solution
- alternatives
- priority
- blocking
- proposed_task

## Discovery types

DEFECT, MISSING_REQUIREMENT, ARCHITECTURE_GAP, NEW_DEPENDENCY, TECH_DEBT, SECURITY_FINDING, UX_GAP, QA_GAP, PERFORMANCE_GAP, DOCUMENTATION_GAP.

## Rework

Use REWORK only when the delivered implementation does not satisfy the accepted task contract. Rework remains attached to the original task and does not silently expand scope.

## New task creation

A Discovery becomes a task only after AI CTO triage. The new task keeps `origin_discovery` and `discovered_from` links.

## Traceability

Original task → review → discovery → new task → dependency → completion.

Never erase the original requirement to hide scope growth.
