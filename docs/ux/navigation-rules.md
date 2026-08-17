# Navigation rules

**Owner:** UI/UX Lead

## Principles
- The child always knows what to do next.
- Back navigation never loses an unfinished attempt.
- A rewarded completion must not reopen a mutable state accidentally.
- Deep links must verify session, family and permission before opening content.
- Expired invitations and unavailable content have a clear destination.

## Main child navigation

`Мой день` → `Задание` → `Выполнение` → `Результат` → `Мой день`.

Optional branches: `Награда`, `Достижение`, `Друзья`, `Игра`.

## Main parent navigation

`Обзор` → `Ребёнок` → `Задания` / `Подтверждения` / `Награды` / `История`.

`Общение` → `Друзья` → `Чат` → `Кейс` → `Семейная активность`.

## Guards

- Unauthenticated users go to sign-in.
- A user without family access gets a safe access-denied screen.
- A child cannot navigate into parent screens by route manipulation.
- A parent cannot open another family's private child data through a saved link.

## Acceptance

All supported entry points converge on the same permission-aware state machine. No screen relies on hidden UI controls as its only protection.
