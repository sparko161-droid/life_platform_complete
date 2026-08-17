# Coding Standards

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## General
Strict TypeScript. Prefer explicit domain types. Small modules. Pure functions for business rules where possible.

## Naming
Domain terms use the product glossary. Avoid synonyms for the same concept (`TaskAssignment` vs `Assignment`) unless they represent different concepts.

## Error handling
Use typed application errors. Do not leak provider/database internals.

## Dependency direction
Domain layer must not depend on web framework details when avoidable. Integrations are adapters.

## Database
No ad-hoc SQL scattered across handlers. Repository/data-access belongs to owning domain.

## Logging
Structured logs only; no child PII or message text in default logs.

## Comments
Explain why, not what. Architecture decisions belong in docs/ADR.

## Refactoring
No opportunistic wide refactors inside feature work. Create a separate task unless required for correctness.
