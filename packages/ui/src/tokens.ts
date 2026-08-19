import type { UiRewardState, UiTaskState } from "@life/ux-contracts";

/**
 * Semantic state -> visual token mapping (P1-010).
 *
 * Keyed by `UiTaskState` / `UiRewardState` from @life/ux-contracts, so
 * these are exhaustive by construction: adding a state to the contract
 * makes this file a type error rather than silently rendering the
 * fallback. That is the point -- docs/ux/error-recovery.md exists
 * because unhandled states are the defect, and a `Record<UiTaskState, T>`
 * turns "unhandled" into "does not compile".
 */
export type StateTone = "progress" | "success" | "warning" | "danger" | "neutral";

export const TASK_STATE_TONE: Record<UiTaskState, StateTone> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "progress",
  SUBMITTED: "progress",
  VERIFYING: "progress",
  APPROVED: "success",
  // REJECTED is a parent asking for another try, FAILED is an automatic
  // verification miss -- ux-contracts keeps them distinct on purpose
  // (deriveUiTaskState), so they must not collapse to one colour here.
  REJECTED: "warning",
  FAILED: "danger",
  REWARD_PENDING: "progress",
  COMPLETED: "success",
};

export const REWARD_STATE_TONE: Record<UiRewardState, StateTone> = {
  LOCKED: "neutral",
  AVAILABLE: "success",
  REDEEMING: "progress",
  REDEEMED: "success",
  EXPIRED: "neutral",
  FAILED: "danger",
};

/** Tailwind classes per tone. Kept in one place so a tone is styled once. */
export const TONE_CLASSES: Record<StateTone, string> = {
  progress: "bg-state-progress/10 text-state-progress border-state-progress/30",
  success: "bg-state-success/10 text-state-success border-state-success/30",
  warning: "bg-state-warning/10 text-state-warning border-state-warning/30",
  danger: "bg-state-danger/10 text-state-danger border-state-danger/30",
  neutral: "bg-surface-sunken text-ink-muted border-ink-muted/20",
};
