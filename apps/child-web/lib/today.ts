import type { ScreenStates } from "@life/ux-contracts";

/**
 * C-TODAY state derivation (P1-004).
 *
 * A pure function, kept out of the component so the precedence between
 * states is a rule that can be read and argued with rather than an
 * accident of JSX ordering -- and so it can be tested without a DOM.
 */

export interface TodayCard {
  taskAssignmentId: string;
  title: string;
  status: string;
  rewardXp: number;
  rewardCoins: number;
  dueAt?: string;
}

export type TodayState = ScreenStates<"C-TODAY">;

/** Statuses that mean the child has nothing left to do on a card. */
const SETTLED = new Set(["APPROVED", "COMPLETED", "ARCHIVED"]);

export interface TodayInput {
  cards: TodayCard[] | null;
  online: boolean;
  syncFailed: boolean;
  /** True when this child has never had an assignment before. */
  everHadTasks: boolean;
  now?: Date;
}

export function deriveTodayState({ cards, online, syncFailed, everHadTasks, now = new Date() }: TodayInput): TodayState {
  // Connectivity first: everything below describes data we may not have.
  if (!online) return "OFFLINE";
  if (syncFailed) return "FAILED_SYNC";

  if (!cards || cards.length === 0) {
    // FIRST_DAY and NO_TASKS look identical in the data and mean very
    // different things to a child -- "you're new here" versus "nothing
    // today". Nothing distinguished them until `everHadTasks` did, which
    // is why FIRST_DAY was previously a state the contract declared and
    // no run could ever reach (recorded in the P1-016 handoff).
    return everHadTasks ? "NO_TASKS" : "FIRST_DAY";
  }

  // Overdue outranks completion: something needing attention matters
  // more than celebrating the rest.
  if (cards.some((c) => c.dueAt && new Date(c.dueAt) < now && !SETTLED.has(c.status))) return "OVERDUE";
  if (cards.every((c) => SETTLED.has(c.status))) return "ALL_COMPLETE";
  return "NORMAL_DAY";
}

/**
 * What the child is invited to do on a card.
 *
 * docs/ux/screens/child-today.md requires every actionable thing to be
 * reachable with no dead ends, and docs/ux/ui-language.md forbids
 * showing the status itself -- "SUBMITTED" is an internal label, not
 * something to put in front of a seven-year-old.
 */
export function cardInvitation(status: string): string {
  switch (status) {
    case "ASSIGNED":
      return "Начать";
    case "IN_PROGRESS":
      return "Продолжить";
    case "SUBMITTED":
    case "VERIFYING":
      return "Ждём проверки";
    case "APPROVED":
    case "COMPLETED":
      return "Готово";
    case "REJECTED":
      return "Попробовать ещё раз";
    default:
      // An unfamiliar status from a newer server. Saying "open it" is
      // always true and never wrong; guessing would not be.
      return "Открыть";
  }
}
