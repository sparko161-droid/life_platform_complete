# UI language policy

**Owner:** UI/UX Lead
**Review:** Product + Child Experience + Documentation

## Rule
All visible product text is Russian by default. Technical names, internal identifiers, API names and developer terminology must never leak into user-facing UI.

## Do not show
- English labels such as `Task`, `Level`, `XP`, `Coins`, `Streak`, `API`, `AI`, `Loading`, `Error`, `Admin`.
- Database/entity names, route names, event names or permission codes.
- Internal error messages and stack traces.
- Raw provider terminology unless required by legal/consent UI.

## Preferred wording
- Task → «Задание»
- Quest → «Квест» or «Миссия» according to child context
- Level → «Уровень»
- XP → «Опыт»
- Coins → «Монеты»
- Streak → «Серия»
- Reward → «Награда»
- Achievement → «Достижение»
- Chat → «Чат»
- Profile → «Профиль»
- Settings → «Настройки»
- Error → «Не получилось» / contextual explanation
- Loading → «Загружаем…» / contextual progress

## Child language
Use short, friendly, age-appropriate phrases. Prefer action verbs and positive guidance. Do not shame failures or expose technical causes.

## Parent language
Use clear Russian explanations. A parent may see more detail, but still no raw internal terminology.

## Exceptions
Brand/provider names may appear only when they are meaningful to the user, for example «Алиса», «Телеграм» or «MAX». Technical provider names are never used as interface concepts.

## Localization
Every visible string must come from the localization system. No hard-coded UI text in components.

## Acceptance
A UI review can verify that a normal user cannot see implementation names or unexplained English terminology anywhere in a supported screen state.
