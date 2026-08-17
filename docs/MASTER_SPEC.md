# Master Specification — «Жизнь»

**Версия:** 0.1
**Статус:** Foundation / Architecture Baseline
**Владелец:** Human Architect / Product Owner

## 1. Product mission

«Жизнь» превращает реальные действия ребёнка в игровую систему развития: задания → выполнение → подтверждение → прогресс → игра → социальное взаимодействие → награда.

Цель — не заставить ребёнка выполнять chores, а сделать самостоятельность, обучение, спорт и общение частью игры.

## 2. Core principles

1. Реальная жизнь является главным игровым миром.
2. Ребёнок — игрок, родитель — создатель и оператор правил семьи.
3. Деньги — только один вид награды, а не основная мотивация.
4. Родительские правила гибкие: система предлагает, родитель решает.
5. Детские функции проектируются privacy-first.
6. Social graph родителей и детей разделён.
7. Mobile/web clients не содержат доменную логику.
8. AI предлагает и помогает, но критические решения принадлежат человеку.
9. ML/CV используется как сенсор; deterministic engine принимает решение о зачёте упражнений.
10. Любой новый домен сначала получает архитектурный контракт.

## 3. Product domains

- Identity / Auth
- Family / Parents / Children
- Tasks / Habits / Quests / Scenarios
- Verification Engine
- Exercise / Pose Engine
- XP / Coins / Money / Rewards
- Game Engine
- Social Graph
- Messenger
- Notifications
- AI / Knowledge Base / Avatar
- Catalog / Cases / Marketplace
- Learning
- Safety / Moderation
- Analytics
- Integrations
- Admin

## 4. Client surfaces

- Child Web/PWA
- Parent Web
- Admin Web
- Android App
- iOS App
- Telegram Mini App / Bot
- MAX Mini App / Bot
- Alice skill

## 5. Technical foundation

- Monorepo
- TypeScript for web/backend/shared packages
- NestJS modular monolith + workers
- PostgreSQL as source of truth
- Redis for cache/locks/queue transport
- BullMQ for async jobs
- WebSocket for realtime
- S3-compatible storage for media
- Flutter for Android/iOS
- REST/OpenAPI for core integration
- Adapter pattern for Alice/Telegram/MAX/AI providers
- Docker Compose for local development

## 6. Architecture direction

Начинаем с modular monolith + workers + realtime. Микросервисы выделяются только при подтверждённой необходимости.

Домены общаются через application services и domain events, а не прямым доступом к чужим таблицам.

## 7. Task Engine foundation

Task состоит из content, schedule, rules, verification, reward, gameplay и notifications.

Initial verification strategies:

- MANUAL_SELF
- PARENT_APPROVAL
- PHOTO_PROOF
- VIDEO_PROOF
- CAMERA_EXERCISE
- TIMER
- COUNTER
- AUDIO_PROOF
- COMPOSITE

## 8. Verification principle

`Task → Verification Strategy → Result → Reward/Event`.

Для камеры:
`Camera → Pose Provider → Landmarks → Exercise Engine → Result`.

Видео по умолчанию не отправляется на сервер; сервер получает результат проверки.

## 9. Social foundation

Separate graphs:

- Parent Friendship
- Child Friendship
- Family Friendship
- Groups / Challenges

Ребёнок не получает unrestricted discovery of unknown children.

## 10. Messenger foundation

Типы: TEXT, VOICE, VIDEO_CIRCLE, IMAGE, SYSTEM, GAME_INVITE, ACHIEVEMENT, QUEST.

Доступ родителя к детским чатам управляется policy, чтобы в будущем можно было перейти от FULL к METADATA_ONLY или DISABLED без переделки Messenger.

## 11. AI foundation

Все AI providers скрыты за `AI Gateway`. AI не получает прямой доступ к БД.

AI использует Knowledge Base, task/domain APIs и ограниченные tools.

MCP — интеграционный слой, не источник бизнес-логики.

## 12. Integrations

Telegram/MAX — web mini-app adapters.
Alice — skill adapter + OAuth account linking.

Внешние каналы не содержат собственной бизнес-логики.

## 13. Data safety

Минимизировать сбор данных детей. Медиа приватны по умолчанию. Доступ к детским данным проверяется permission policy на backend.

Для РФ необходим отдельный legal/privacy review перед production.

## 14. AI Engineering Organization

AI CTO координирует специализированных агентов. Human Architect принимает продуктовые и архитектурные решения, влияющие на фундамент.

Работа проходит через gates: Architecture → Implementation → Quality → QA → Security → Human Acceptance.

## 15. Definition of Ready

Задача не переходит в implementation, пока:

- найден существующий domain;
- определены зависимости;
- проверены дубли;
- определены API/events/contracts;
- понятен test strategy;
- архитектурные вопросы вынесены человеку.

## 16. Definition of Done

Code + tests + docs + migration + observability + security checks + architecture review + QA + acceptance.

## 17. Repository governance

Каждый агент работает в своей ветке/worktree. `main` защищён. Merge только через PR и обязательные gates.

Production secrets не доступны обычным coding agents.

## 18. Documentation governance

Каждый domain имеет короткие связанные документы. Master Specification только фиксирует фундамент и ссылки.

Изменение фундаментального решения требует ADR.

## 19. Initial delivery sequence

Phase 0 — workspace and AI-team infrastructure.
Phase 1 — family/auth/task foundation.
Phase 2 — verification/rewards/PWA.
Phase 3 — Android/iOS.
Phase 4 — social/messenger.
Phase 5 — AI/Alice/learning.
Phase 6 — games/marketplace/community.

## 20. Non-goals for foundation

Не строим сразу Kubernetes, полноценную микросервисную сеть, открытый child social discovery, real-money payment rail, public marketplace без moderation.

## 21. Source anchors

Flutter iOS setup: https://docs.flutter.dev/platform-integration/ios/setup
Telegram Mini Apps: https://core.telegram.org/bots/webapps
Alice skills: https://yandex.ru/dev/dialogs/alice/
Alice OAuth/account linking: https://yandex.ru/dev/dialogs/alice/doc/ru/auth/how-it-works
