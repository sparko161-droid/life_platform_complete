import type { Guardrail } from "./guardrail.js";

/**
 * Phase 1 scale guardrail assessment (P1-022).
 *
 * One entry per docs/architecture/phase-1-scale-guardrails.md "Mandatory
 * checks" bullet, in the same order, so the two can be diffed by eye.
 * test/guardrails.test.ts asserts VERIFIED entries against real code (not
 * just this file's prose) and that every DEFERRED entry's riskId resolves
 * to a real SCALE_RISK_REGISTER entry.
 */
export const SCALE_GUARDRAILS: readonly Guardrail[] = [
  {
    id: "SG-001",
    check: "Unbounded task history/reward history uses cursor pagination.",
    status: "DEFERRED",
    evidence: "No persistence layer or history-listing endpoint exists yet to paginate (BLK-P1-007 is open); packages/ux-contracts's action catalog does not yet define one either.",
    reference: "docs/architecture/phase-1-scale-guardrails.md; tasks/phase-1-blockers.yaml BLK-P1-007",
    riskId: "SR-001",
  },
  {
    id: "SG-002",
    check: "Critical family/task/assignment lookups have indexes matching actual query predicates.",
    status: "DEFERRED",
    evidence: "No database or migrations exist yet (BLK-P1-007 is open); indexes cannot be designed against query predicates that do not exist.",
    reference: "tasks/phase-1-blockers.yaml BLK-P1-007",
    riskId: "SR-002",
  },
  {
    id: "SG-003",
    check: "Critical journeys have no known N+1 access pattern.",
    status: "DEFERRED",
    evidence: "The domain layer (packages/domain-types) is pure in-memory functions with zero data-access calls -- there is no query code yet to have an N+1 pattern in.",
    reference: "tasks/phase-1-blockers.yaml BLK-P1-007",
    riskId: "SR-003",
  },
  {
    id: "SG-004",
    check: "Media bytes are not stored in the primary relational database when the architecture says object storage is authoritative.",
    status: "VERIFIED",
    evidence: "MediaEvidenceSchema (packages/domain-types/src/media.ts) carries only an opaque storageKey string; no bytes/blob/base64-shaped field exists on the schema, so media content structurally cannot be stored inline even by accident.",
    reference: "test/guardrails.test.ts: 'SG-004: MediaEvidenceSchema has no inline-bytes field'",
  },
  {
    id: "SG-005",
    check: "Reward ledger access remains append-only and queryable by child/source/time without full-table scans at the expected foundation dataset size.",
    status: "DEFERRED",
    evidence: "Append-only is structurally guaranteed today (RewardLedgerEntrySchema has no mutable balance field; computeBalance always derives from the entry set, per packages/domain-types/test/reward-service.test.ts). The 'without full-table scans' half needs a real DB index once ledgers are persisted -- computeBalance/findDuplicateEntry are correct but O(n) over an in-memory array, which the domain layer has no way to bound or index.",
    reference: "test/guardrails.test.ts: 'SG-005: the reward ledger has no mutable balance field'",
    riskId: "SR-004",
  },
  {
    id: "SG-006",
    check: "Concurrent completion/approval/reward writes have explicit locking/unique-key/version semantics.",
    status: "VERIFIED",
    evidence: "checkVersion/checkAssignmentVersion (packages/domain-types/src/concurrency.ts) give explicit optimistic-version semantics; grantTaskReward/grantStreakBonus/confirmRedemption (idempotency.ts, reward-service.ts) give explicit idempotency-key semantics. Both are exercised by real regression tests, not just present in the API surface.",
    reference: "test/guardrails.test.ts: 'SG-006: concurrent writes have version and idempotency-key semantics'",
  },
  {
    id: "SG-007",
    check: "Async events are bounded and retryable without producing duplicate domain truth.",
    status: "VERIFIED",
    evidence: "IDEMPOTENCY_RULES (packages/domain-types/src/idempotency.ts) documents and tests replay-safety for all 7 pipeline stages; every reward-granting function returns duplicate:true on replay with no new ledger entry or event.",
    reference: "test/guardrails.test.ts: 'SG-007: replaying a reward grant produces no duplicate domain truth'",
  },
  {
    id: "SG-008",
    check: "Cache use, when introduced, cannot become an authoritative store.",
    status: "NOT_APPLICABLE",
    evidence: "No cache (Redis or otherwise) has been introduced anywhere in this repo yet -- there is nothing to check today. Revisit this guardrail the moment a cache is added anywhere in the stack.",
    reference: "N/A -- absence confirmed by repo-wide search; no cache dependency exists in any package.json",
  },
] as const;
