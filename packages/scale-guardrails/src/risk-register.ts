import type { ScaleRisk } from "./guardrail.js";

/**
 * Scale risk register (P1-022).
 *
 * docs/architecture/phase-1-scale-guardrails.md "Required evidence":
 * "Risks not solved in Phase 1 require an owner, reason and phase
 * target." Every DEFERRED guardrail in guardrails.ts must point at an
 * entry here (enforced by GuardrailSchema); this is that entry list.
 */
export const SCALE_RISK_REGISTER: readonly ScaleRisk[] = [
  {
    id: "SR-001",
    risk: "Unbounded task/reward history has no cursor pagination -- there is no persistence layer or query endpoint to paginate yet.",
    owner: "backend-lead / devops-lead",
    reason: "No persistence layer exists yet (BLK-P1-007 is open); pagination is a property of a real query endpoint, not the domain layer.",
    phaseTarget: "Phase 1 W7, when BLK-P1-007's persistence/API layer is built -- cursor pagination must ship with the first history-listing endpoint, not be retrofitted after.",
  },
  {
    id: "SR-002",
    risk: "No database indexes exist for family/task/assignment lookups by the query predicates the real API will actually use.",
    owner: "backend-lead / devops-lead",
    reason: "No database exists yet (BLK-P1-007 is open); indexes cannot be designed against migrations that do not exist.",
    phaseTarget: "Phase 1 W7, alongside the first migrations -- indexes must match the real query predicates the API layer issues, not be guessed in advance.",
  },
  {
    id: "SR-003",
    risk: "N+1 access patterns on the critical parent/child journey (today -> task -> proof -> approval -> reward) cannot be assessed without a real query layer to inspect.",
    owner: "backend-lead",
    reason: "No queries exist yet to have an N+1 pattern in (BLK-P1-007 is open); the domain layer is pure in-memory functions with no data-access calls to audit.",
    phaseTarget: "Phase 1 W7, as part of the persistence layer's implementation review -- audit every repository method the application layer adds for N+1 before it ships.",
  },
  {
    id: "SR-004",
    risk: "computeBalance/findDuplicateEntry (packages/domain-types/src/reward-service.ts) are correct but O(n) full-array scans over the caller-supplied ledger entry set; acceptable at Phase 1's foundation dataset size but will need a real DB index/aggregate query once ledgers are persisted and grow.",
    owner: "backend-lead / game-engine-lead",
    reason: "The domain layer intentionally has no I/O and no notion of dataset size (docs/architecture/phase-1-scale-guardrails.md's checks target the persistence layer, which does not exist yet -- BLK-P1-007).",
    phaseTarget: "Phase 1 W7 (index the ledger by childId/sourceTaskAssignmentId/postedAt when persisted); revisit at Phase 2 load testing if per-child ledger size grows beyond foundation scale.",
  },
] as const;
