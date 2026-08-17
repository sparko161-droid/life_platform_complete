# Task Builder DSL and Rules Engine

**Owner:** Task/Game Domain Architect
**Review:** Backend, UX, QA

## Builder blocks

Content, schedule, audience, prerequisites, conditions, verification, evidence, reward, progression, notifications and presentation.

## Rule model

Rules are declarative and versioned. A task assignment references an immutable task-template version plus family-local overrides.

## Composite tasks

A scenario may contain ordered or parallel child tasks. Completion policy can be ALL, ANY, COUNT, SCORE or PARENT_DECISION.

## Conditions

Age band, skill, prior completion, streak, time window, family settings, reward budget and prerequisite achievement may gate an assignment.

## Verification

Each verification block produces a typed result. Composite verification may require multiple independent proofs.

## Parent editing

Catalog templates are copied into the family namespace before editing. Global content is never mutated by a family.

## AI

AI can draft DSL instances and explain rules, but activation requires policy validation and parent approval where the plan changes child schedule, permissions or rewards.

## Versioning

Published task versions are immutable. New edits create a new version; active assignments retain their referenced version unless explicitly migrated.
