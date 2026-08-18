# Phase 1 Scale Guardrails

Phase 1 is not a production load-test phase. It is the phase where architecture must stop obvious scaling failures from becoming foundational assumptions.

## Mandatory checks

- Unbounded task history/reward history uses cursor pagination.
- Critical family/task/assignment lookups have indexes matching actual query predicates.
- Critical journeys have no known N+1 access pattern.
- Media bytes are not stored in the primary relational database when the architecture says object storage is authoritative.
- Reward ledger access remains append-only and queryable by child/source/time without full-table scans at the expected foundation dataset size.
- Concurrent completion/approval/reward writes have explicit locking/unique-key/version semantics.
- Async events are bounded and retryable without producing duplicate domain truth.
- Cache use, when introduced, cannot become an authoritative store.

## Required evidence

The Performance/Scale Agent records targeted query/benchmark results and a scale-risk register. Risks not solved in Phase 1 require an owner, reason and phase target.
