import type { ReactNode } from "react";
import type { UiTaskState } from "@life/ux-contracts";
import { TASK_STATE_TONE, TONE_CLASSES, type StateTone } from "../tokens.js";

/**
 * Shared primitives (P1-010). Deliberately small: the design system's
 * job right now is to stop the two apps drifting apart, not to
 * anticipate every component. Each one exists because both surfaces
 * need it.
 *
 * `surface` ("parent" | "child") is a prop rather than two component
 * sets: the child surface differs by scale (larger touch targets and
 * type per docs/ux/ui-architecture.md), not by structure, and one
 * component with a scale prop cannot drift the way two copies would.
 */
export type Surface = "parent" | "child";

function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

export interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary";
  surface?: Surface;
  disabled?: boolean;
  /** Accessible label when the visible text alone is not descriptive. */
  ariaLabel?: string;
}

export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  surface = "parent",
  disabled = false,
  ariaLabel,
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cx(
        "inline-flex items-center justify-center rounded-control px-4 font-medium transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        "disabled:cursor-not-allowed disabled:opacity-50",
        surface === "child" ? "min-h-touch-child text-child-base" : "min-h-touch text-base",
        variant === "primary"
          ? "bg-brand text-ink-inverse hover:bg-brand-strong"
          : "border border-ink-muted/30 bg-surface text-ink hover:bg-surface-muted",
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export interface CardProps {
  children: ReactNode;
  as?: "div" | "li" | "article";
}

export function Card({ children, as: Tag = "div" }: CardProps) {
  return <Tag className="rounded-card border border-ink-muted/15 bg-surface p-4 shadow-sm">{children}</Tag>;
}

// ---------------------------------------------------------------------------
// StateBanner
// ---------------------------------------------------------------------------

export interface StateBannerProps {
  tone: StateTone;
  children: ReactNode;
  /**
   * `status` for progress/success (announced politely), `alert` for
   * danger (announced immediately) -- docs/ux/ui-architecture.md's
   * screen-reader requirement, decided by tone rather than left to each
   * call site to remember.
   */
  ariaLive?: boolean;
}

export function StateBanner({ tone, children, ariaLive = true }: StateBannerProps) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      aria-live={ariaLive ? (tone === "danger" ? "assertive" : "polite") : undefined}
      className={cx("rounded-control border px-3 py-2 text-sm", TONE_CLASSES[tone])}
    >
      {children}
    </div>
  );
}

/** StateBanner keyed directly by a contract task state -- no tone guessing at the call site. */
export function TaskStateBanner({ state, children }: { state: UiTaskState; children: ReactNode }) {
  return <StateBanner tone={TASK_STATE_TONE[state]}>{children}</StateBanner>;
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

export interface EmptyStateProps {
  /** Russian-only, from the app's localization -- never a raw English literal. */
  title: string;
  description?: string;
  action?: ReactNode;
  surface?: Surface;
}

export function EmptyState({ title, description, action, surface = "parent" }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-ink-muted/30 px-6 py-10 text-center">
      <p className={cx("font-medium text-ink", surface === "child" ? "text-child-lg" : "text-lg")}>{title}</p>
      {description ? <p className="max-w-sm text-sm text-ink-muted">{description}</p> : null}
      {action}
    </div>
  );
}
