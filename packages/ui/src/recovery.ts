/**
 * Recovery states (P1-016).
 *
 * `docs/ux/error-recovery.md` requires every failure to leave the user
 * somewhere they can act, rather than at a dead end. This module is the
 * one place that decides what a given API failure means for a person, so
 * two surfaces cannot disagree about it and no screen has to guess.
 *
 * The mapping is keyed on the stable `code` from the API's error
 * envelope, never on an HTTP status alone: a 403 from a family-isolation
 * check and a 403 from a spent pairing code are the same status and
 * completely different situations for the user.
 *
 * What this module deliberately does *not* do is explain the cause. The
 * API returns undifferentiated failures on purpose in several places --
 * sign-in and pairing both refuse to say which half was wrong, because
 * saying so is an enumeration oracle. Copy here follows that: it says
 * what to do next.
 */

/** What the user can actually do about it. */
export type RecoveryAction = "RETRY" | "REFRESH" | "SIGN_IN" | "ASK_ADULT" | "NONE";

export interface RecoveryState {
  /** Russian, user-facing (docs/ux/ui-language.md). */
  message: string;
  action: RecoveryAction;
  /** Label for the action control; absent when action is NONE. */
  actionLabel?: string;
  /**
   * True when retrying the identical request is safe. Mutating calls
   * carry an idempotency key, so a retry is safe there too -- but a
   * conflict means the state moved underneath us, and repeating the same
   * request would be wrong rather than merely useless.
   */
  retrySafe: boolean;
}

const PARENT_RECOVERY: Record<string, RecoveryState> = {
  CONFLICT: {
    // Someone else acted on the same thing. Repeating the request would
    // apply a decision made against stale state, so the honest recovery
    // is to reload and look again -- not to retry.
    message: "Кто-то уже изменил это. Обновите страницу, чтобы увидеть актуальное состояние.",
    action: "REFRESH",
    actionLabel: "Обновить",
    retrySafe: false,
  },
  INVALID_SESSION: {
    message: "Сессия закончилась. Войдите снова.",
    action: "SIGN_IN",
    actionLabel: "Войти",
    retrySafe: false,
  },
  MISSING_SESSION: {
    message: "Нужно войти, чтобы продолжить.",
    action: "SIGN_IN",
    actionLabel: "Войти",
    retrySafe: false,
  },
  NOT_FOUND: {
    message: "Не нашли это. Возможно, оно было удалено.",
    action: "REFRESH",
    actionLabel: "Обновить",
    retrySafe: false,
  },
  TOO_MANY_ATTEMPTS: {
    message: "Слишком много попыток. Попробуйте позже.",
    action: "NONE",
    retrySafe: false,
  },
  NETWORK_ERROR: {
    message: "Нет связи с сервисом. Попробуйте ещё раз.",
    action: "RETRY",
    actionLabel: "Повторить",
    retrySafe: true,
  },
  INTERNAL_ERROR: {
    message: "Что-то пошло не так. Попробуйте ещё раз.",
    action: "RETRY",
    actionLabel: "Повторить",
    retrySafe: true,
  },
};

/**
 * Child-surface overrides. A child cannot sign in (they hold no
 * credentials by contract, ADR-0006 D3), so "войдите снова" would be
 * advice they cannot follow -- the only real recovery is to ask an
 * adult. Copy is also shorter and non-technical for the 4-12 range
 * confirmed in HD-P1-034-1.
 */
const CHILD_RECOVERY: Record<string, RecoveryState> = {
  CONFLICT: {
    message: "Тут что-то изменилось. Обнови страницу.",
    action: "REFRESH",
    actionLabel: "Обновить",
    retrySafe: false,
  },
  INVALID_SESSION: {
    message: "Нужно снова открыть доступ. Попроси взрослого.",
    action: "ASK_ADULT",
    retrySafe: false,
  },
  MISSING_SESSION: {
    message: "Нужно снова открыть доступ. Попроси взрослого.",
    action: "ASK_ADULT",
    retrySafe: false,
  },
  NOT_FOUND: {
    message: "Не нашли это задание.",
    action: "REFRESH",
    actionLabel: "Обновить",
    retrySafe: false,
  },
  NOT_ACTIVE_FAMILY_MEMBER: {
    message: "Это не твоё задание.",
    action: "NONE",
    retrySafe: false,
  },
  NETWORK_ERROR: {
    message: "Нет связи. Попробуй ещё раз.",
    action: "RETRY",
    actionLabel: "Повторить",
    retrySafe: true,
  },
  INTERNAL_ERROR: {
    message: "Что-то сломалось. Попробуй ещё раз.",
    action: "RETRY",
    actionLabel: "Повторить",
    retrySafe: true,
  },
};

/** Used when a code is not in the table -- never a raw error string. */
const FALLBACK: Record<"parent" | "child", RecoveryState> = {
  parent: {
    message: "Что-то пошло не так. Попробуйте ещё раз.",
    action: "RETRY",
    actionLabel: "Повторить",
    retrySafe: true,
  },
  child: { message: "Что-то сломалось. Попроси взрослого.", action: "ASK_ADULT", retrySafe: false },
};

/**
 * Maps an API error code to what the user should do.
 *
 * An unknown code falls back rather than surfacing itself: showing a raw
 * code to a user leaks internal vocabulary
 * (docs/ux/ui-language.md forbids it) and tells them nothing actionable.
 */
export function recoveryFor(code: string | undefined, surface: "parent" | "child" = "parent"): RecoveryState {
  const table = surface === "child" ? CHILD_RECOVERY : PARENT_RECOVERY;
  return (code ? table[code] : undefined) ?? FALLBACK[surface];
}

/** Every code this module knows -- used by tests to check coverage. */
export const KNOWN_RECOVERY_CODES: readonly string[] = [
  ...new Set([...Object.keys(PARENT_RECOVERY), ...Object.keys(CHILD_RECOVERY)]),
];
