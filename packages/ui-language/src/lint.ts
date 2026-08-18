/**
 * Russian-only UI localization lint and forbidden-term checks (P1-012).
 *
 * Machine-checkable counterpart to docs/ux/ui-language.md:
 *
 *   "All visible product text is Russian by default. Technical names,
 *    internal identifiers, API names and developer terminology must never
 *    leak into user-facing UI."
 *
 * This module is deliberately narrow: it lints *string values* (the
 * localized copy itself), not component source files -- there is no UI
 * framework wired up yet in this repo (packages/ui is still a Phase 1+
 * placeholder). Once real components exist and pull strings from a
 * localization system, the same `lintCatalog` is meant to run over every
 * locale file that ships user-facing copy, and a follow-up static check
 * (grep for hard-coded JSX string literals) can be added without changing
 * this module's contract.
 *
 * Three violation classes, from the two source-of-truth documents:
 *
 *   1. FORBIDDEN_TERM -- the copy contains one of ui-language.md's "Do not
 *      show" English labels (Task, Level, XP, Coins, Streak, Reward,
 *      Achievement, Chat, Profile, Settings, Error, Loading, API, AI,
 *      Admin). Carries the doc's preferred Russian wording when one exists.
 *   2. NON_CYRILLIC_TEXT -- any other Latin-script word not on the brand
 *      exception list (docs/ux/ui-language.md "Exceptions": Алиса,
 *      Телеграм, MAX). This is the general "Russian-only" enforcement --
 *      FORBIDDEN_TERM is the specific, named subset of it.
 *   3. INTERNAL_IDENTIFIER_LEAK -- the value itself looks like a route
 *      path or an ALL_CAPS_SNAKE_CASE enum/state name rather than
 *      user-facing copy, per "Database/entity names, route names, event
 *      names or permission codes" in the "Do not show" list.
 */

// ---------------------------------------------------------------------------
// Term catalogs
// ---------------------------------------------------------------------------

/** @public */
export interface ForbiddenTerm {
  term: string;
  /** The doc's preferred Russian wording, when ui-language.md states one. */
  preferred?: string;
}

/**
 * ui-language.md's "Do not show" list, plus every left-hand term from its
 * "Preferred wording" table (a term can appear in one section, both, or
 * neither -- both are folded into one lint-checkable list here).
 * @public
 */
export const FORBIDDEN_TERMS: readonly ForbiddenTerm[] = [
  { term: "Task", preferred: "Задание" },
  { term: "Level", preferred: "Уровень" },
  { term: "XP", preferred: "Опыт" },
  { term: "Coins", preferred: "Монеты" },
  { term: "Streak", preferred: "Серия" },
  { term: "Reward", preferred: "Награда" },
  { term: "Achievement", preferred: "Достижение" },
  { term: "Chat", preferred: "Чат" },
  { term: "Profile", preferred: "Профиль" },
  { term: "Settings", preferred: "Настройки" },
  { term: "Error", preferred: "«Не получилось» / contextual explanation" },
  { term: "Loading", preferred: "«Загружаем…» / contextual progress" },
  { term: "API" },
  { term: "AI" },
  { term: "Admin" },
] as const;

/**
 * Brand/provider names ui-language.md's "Exceptions" section allows
 * verbatim. Note: the doc itself writes «Алиса» and «Телеграм» in
 * Cyrillic already (so they never trip the Latin-script check) -- only
 * "MAX" is a genuine Latin-script exception.
 * @public
 */
export const ALLOWED_LATIN_EXCEPTIONS: readonly string[] = ["MAX"] as const;

// ---------------------------------------------------------------------------
// Violations
// ---------------------------------------------------------------------------

/** @public */
export const LINT_VIOLATION_CODES = [
  "FORBIDDEN_TERM",
  "NON_CYRILLIC_TEXT",
  "INTERNAL_IDENTIFIER_LEAK",
] as const;
/** @public */
export type LintViolationCode = (typeof LINT_VIOLATION_CODES)[number];

/** @public */
export interface LintViolation {
  code: LintViolationCode;
  /** The catalog key the offending value was found under. */
  key: string;
  /** The specific offending substring, or the whole value for identifier-leak checks. */
  term: string;
  message: string;
  /** Present only for FORBIDDEN_TERM when ui-language.md states a preferred wording. */
  suggestion?: string;
}

const ROUTE_PATTERN = /^\/[a-z0-9/_:-]+$/iu;
const ENUM_PATTERN = /^[A-Z][A-Z0-9_]*$/u;

function findForbiddenTerm(word: string): ForbiddenTerm | undefined {
  const lower = word.toLowerCase();
  return FORBIDDEN_TERMS.find((t) => t.term.toLowerCase() === lower);
}

/**
 * Lints a single localized string value. `key` is the catalog key it was
 * found under (used only to label violations, not inspected itself --
 * i18n keys are internal identifiers by convention and are not user-facing).
 * @public
 */
export function lintString(key: string, value: string): LintViolation[] {
  const violations: LintViolation[] = [];
  const trimmed = value.trim();

  const latinWords = value.match(/[A-Za-z]+/gu) ?? [];
  for (const word of latinWords) {
    const forbidden = findForbiddenTerm(word);
    if (forbidden) {
      violations.push({
        code: "FORBIDDEN_TERM",
        key,
        term: word,
        message: `"${word}" is a forbidden UI term (docs/ux/ui-language.md "Do not show").`,
        ...(forbidden.preferred ? { suggestion: forbidden.preferred } : {}),
      });
      continue;
    }
    if (ALLOWED_LATIN_EXCEPTIONS.includes(word)) continue;
    violations.push({
      code: "NON_CYRILLIC_TEXT",
      key,
      term: word,
      message: `"${word}" is Latin-script text in Russian-only UI copy (docs/ux/ui-language.md).`,
    });
  }

  if (trimmed.length > 0 && ROUTE_PATTERN.test(trimmed)) {
    violations.push({
      code: "INTERNAL_IDENTIFIER_LEAK",
      key,
      term: trimmed,
      message: `"${trimmed}" looks like a route path, not user-facing copy.`,
    });
  }
  if (trimmed.length > 2 && ENUM_PATTERN.test(trimmed)) {
    violations.push({
      code: "INTERNAL_IDENTIFIER_LEAK",
      key,
      term: trimmed,
      message: `"${trimmed}" looks like an internal enum/state name, not user-facing copy.`,
    });
  }

  return violations;
}

/**
 * Lints every value in a localization catalog. Keys are never linted
 * themselves (they are internal identifiers by i18n convention); only
 * their string values are checked.
 * @public
 */
export function lintCatalog(catalog: Readonly<Record<string, string>>): LintViolation[] {
  const violations: LintViolation[] = [];
  for (const [key, value] of Object.entries(catalog)) {
    violations.push(...lintString(key, value));
  }
  return violations;
}
