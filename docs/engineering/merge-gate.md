# Merge Gate

**Owner:** AI CTO
**Final authority:** Human Architect

Agent branches are never merged directly to `main` after coding completion.

## Sequence
1. Freeze the source branch and record commit SHA.
2. Run CI on the exact branch tip.
3. Compare against current `main`.
4. Architecture review checks contracts, boundaries and duplication.
5. QA runs focused tests plus affected journeys.
6. Security/child-safety review runs when applicable.
7. Discovery review separates REWORK from new tasks.
8. AI CTO issues `MERGE`, `REWORK`, `BLOCKED` or `MERGE_WITH_FOLLOWUPS`.
9. Human Architect approves merge for foundational or product-significant changes.

## Conflict rule
Do not resolve conflicts by choosing whichever branch is newer. Reconcile against current authoritative docs and contracts.

## Post-merge
Run integration CI again, update task status, documentation traceability and dependent workstreams.

## Rule
No force-push to main. No silent scope changes during merge.