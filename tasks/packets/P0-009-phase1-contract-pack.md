# P0-009 — Phase 1 Contract Pack

## Goal
Freeze the contracts that let identity, family, task and reward streams work in parallel.

## Inputs
MASTER_SPEC, domain map, permissions, data architecture.

## Outputs
Versioned schemas for Family, ParentMembership, ChildProfile, TaskTemplate, TaskAssignment, TaskCompletion, VerificationResult, RewardLedgerEntry.

## Acceptance
Each contract has fields, ownership, authorization, events, versioning and test fixtures.

## Blocking decisions
Money policy, parent role permissions, child profile visibility.

## Parallel consumers
Backend, Parent Web, Child Web, QA.
