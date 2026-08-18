/**
 * The canonical Russian UI string catalog seeded from docs/ux/ui-language.md's
 * "Preferred wording" table (P1-012).
 *
 * This is the "Required Russian-only UI scope" that gets mechanically
 * checked in CI: the acceptance criterion is not "every possible UI string
 * ever written is linted" (no component tree exists yet to pull strings
 * from) but that the canonical terms product/UX has already fixed a Russian
 * wording for stay correct and lint-clean as the single source of truth
 * downstream screens/components are expected to import from, rather than
 * re-inventing or silently drifting from ui-language.md.
 *
 * Extend this catalog (and re-run the lint) whenever a new term is added to
 * ui-language.md's "Preferred wording" table.
 * @public
 */
export const UI_STRINGS: Readonly<Record<string, string>> = {
  task: "Задание",
  quest: "Квест",
  level: "Уровень",
  xp: "Опыт",
  coins: "Монеты",
  streak: "Серия",
  reward: "Награда",
  achievement: "Достижение",
  chat: "Чат",
  profile: "Профиль",
  settings: "Настройки",
  error_generic: "Не получилось",
  loading_generic: "Загружаем…",
} as const;
