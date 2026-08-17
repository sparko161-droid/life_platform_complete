# Phase 1 — Identity, Family and Task Core

## Objective
Deliver the first usable family loop: parent creates child, builds tasks, child completes, parent verifies and reward is recorded.

## Core domains

Identity, Family, Permissions, Child Profile, Task Engine, Assignment, Completion, Media, Reward Ledger.

## Responsible

Backend Lead: domain/API. Frontend Lead: parent/child flows. QA Lead: end-to-end path. Security Lead: authorization. UX Lead: flows.

## Vertical slice

Registration → family → child → task builder → assignment → child completion → verification → reward → history.

## Parallel streams

B1 Auth/Family, B2 Task Domain, B3 Child UX, B4 Parent UX, B5 Media, B6 Economy/ledger, B7 QA fixtures.

## Contracts

Identity IDs, Family membership, TaskTemplate, TaskAssignment, TaskCompletion, VerificationResult, RewardLedgerEntry.

## Exit criteria

One child and two parents can securely use the full core loop on staging without manual DB changes.
