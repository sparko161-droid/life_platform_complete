# Planning Change Log

## 0.4 (contracts/v0.1.0 — P0-009)

- Froze the Phase 1 contract pack: `packages/domain-types` (Family,
  ParentMembership, ChildProfile, TaskTemplate, TaskAssignment,
  TaskCompletion, VerificationResult, MediaEvidence, RewardLedgerEntry,
  domain event envelope) and matching OpenAPI schemas/paths in
  `services/api/openapi/openapi.yaml`.
- Each entity documents ownership, authorization, emitted events and a
  disclosed version (0.1.0); test fixtures per entity in
  `packages/domain-types/test/`.
- Blocking decisions from `tasks/packets/P0-009-phase1-contract-pack.md`
  (money policy precision/currency, parent role permission set, child
  profile visibility) are NOT resolved here — flagged inline in the
  affected schemas for Human Architect confirmation before P1-001/P1-002/
  P1-006 build on them.
- Downstream consumers (P1-001, P1-002, P1-005, P1-006 per
  `tasks/registry.yaml`) should treat this as the frozen contract per
  `docs/planning/phase-handoff.md` ("A downstream stream may start
  against a frozen contract. Breaking changes require a new version...").

## 0.3

- Added Discovery/Rework/New Task policy.
- Added detailed phase documents 0-7.
- Added parallel workstream map and dependency graph.
- Added responsibility matrix.
- Added implementation map.
- Added end-to-end product cases.
- Added Phase 0 task packets and machine-readable registry.
- Clarified no silent scope expansion.
