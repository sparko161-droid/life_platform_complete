# Parent — Task Builder

**Screen ID:** P-TASK-BUILDER
**Owner:** Frontend Lead + Task Architect
**Review:** QA + Code Quality

## Purpose
Create or edit a task without code using the approved task blocks.

## Blocks
Content, schedule, audience, prerequisites, verification, evidence, reward, progression, notifications, presentation.

## Flow
Draft → validation → preview → save → assign/activate.

## Validation
Check age range, contradictory verification, reward permissions, schedule conflicts, dependencies and missing required fields.

## Actions
Every control updates local draft state first. Publish/assign calls a server-authorized command and returns a versioned result.

## States
Draft, saving, validation warnings, validation error, published, assigned, conflict, offline.

## Language
All visible labels and guidance are Russian; technical block names are implementation-only.

## Acceptance
Parent can create a real task entirely through UI, preview the exact child experience and assign it without database edits.
