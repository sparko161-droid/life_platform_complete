# Phase 1 — Family, Auth, Task Builder and First Vertical Slice

## Objective
Deliver the first complete family loop and establish the reusable Task DSL/Rules foundation.

## Core
Registration, parent verification, family lifecycle, second-parent invitation, child profile, permissions, task builder, schedules, recurring tasks, composite tasks, media evidence, parent approval, reward ledger and history.

## Streams
B1 Identity/Family, B2 Task/Rules, B3 Child UX, B4 Parent UX, B5 Media, B6 Economy, B7 QA fixtures.

## Responsible
Backend: domains/API. Frontend: child/parent. Game Lead: reward rules. QA: vertical journey. Security: authorization/consent. UX/Child Experience: age-appropriate flow.

## Required mechanics
Daily/weekly/custom tasks; fixed daily tasks; streaks; configurable 7/10/N-day rewards; money/coupon rewards; photo/video/audio/manual proof; parent approval; task counters; task history; notification triggers; duplicate-assignment prevention; completion/reward idempotency; daily-load preview.

## Contract gate
Task DSL, verification result and reward event schemas freeze before parallel UX/evidence streams consume them.

## Exit
Two parents can securely manage one child. Parent can create/edit a task, assign it, preview load, child can complete it with at least two proof modes, parent can approve, reward is ledgered exactly once and the full journey is auditable without DB edits.
