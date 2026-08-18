/**
 * UI reward state <-> backend RewardStatus mapping (P1-009).
 *
 * docs/ux/state-contracts.md: `LOCKED -> AVAILABLE -> REDEEMING ->
 * REDEEMED | FAILED | EXPIRED`. `RewardStatus`
 * (packages/domain-types/src/reward.ts) is `LOCKED, AVAILABLE, REDEEMING,
 * REDEEMED, EXPIRED, CANCELLED` -- five of six line up directly; FAILED
 * does not.
 *
 * `RewardStatus`'s own transition table
 * (`REWARD_TRANSITIONS.REDEEMING = ["REDEEMED", "AVAILABLE", "CANCELLED"]`)
 * documents why: "a failed/abandoned redemption attempt returns here
 * [AVAILABLE], not straight back to LOCKED, per 'reward reversals are
 * compensating events, never destructive edits'." A failed redemption
 * is not a state the reward *sits in* -- the reward's real status reverts
 * to AVAILABLE (retryable) or, if abandoned outright, moves to CANCELLED.
 * UI FAILED is a transient event the UI shows once (a toast/inline error
 * on the redemption attempt), not a persisted status to render the reward
 * card in -- after showing it, the card reflects the reward's real
 * (AVAILABLE or CANCELLED) status.
 */

import type { RewardStatus } from "@life/domain-types";

export const UI_REWARD_STATES = ["LOCKED", "AVAILABLE", "REDEEMING", "REDEEMED", "EXPIRED", "FAILED"] as const;
export type UiRewardState = (typeof UI_REWARD_STATES)[number];

/** Direct mapping for every backend status that has a persisted UI equivalent. FAILED is intentionally absent -- see the module doc. */
export const REWARD_STATUS_TO_UI_STATE: Record<Exclude<RewardStatus, "CANCELLED">, UiRewardState> = {
  LOCKED: "LOCKED",
  AVAILABLE: "AVAILABLE",
  REDEEMING: "REDEEMING",
  REDEEMED: "REDEEMED",
  EXPIRED: "EXPIRED",
};

/**
 * `CANCELLED` has no card-level UI state of its own: an outright-abandoned
 * redemption is shown as the reward simply being unavailable again, same
 * card treatment as EXPIRED (both say "not redeemable right now," the
 * distinction matters for support/audit, not for the child/parent UI).
 */
export function cancelledRewardUiState(): UiRewardState {
  return "EXPIRED";
}
