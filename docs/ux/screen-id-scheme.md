# Схема идентификаторов экранов

**Owner:** UI/UX Lead
**Review:** Chief Architect, Frontend Lead, Backend Lead, QA Lead
**Задача:** P1-013 (закрывает BLK-P1-001 / DISC-P1-009-1)

## Проблема

В проекте одновременно существовали две схемы идентификаторов экранов:

| Схема | Где жила | Пример |
| --- | --- | --- |
| Семантическая | `packages/ux-contracts/src/screens.ts`, контракты по шаблону | `C-TODAY`, `P-APPROVALS` |
| Позиционная | ранние наброски `docs/ux/screens/01-17-*.md` | `UX-CHI-02`, `UX-PAR-04` |

Один и тот же экран назывался двумя разными именами, и ничто не связывало
эти имена между собой. Для UI, тестов, аналитики и трассируемости это
означало, что ссылка на экран не имеет однозначного разрешения.

## Решение: канонична семантическая схема

Причины, по убыванию веса:

1. **Её уже потребляет код.** `screens.ts`, `actions.ts`, сопоставление с
   операциями OpenAPI и фронтенд ключуются по ней. Позиционная схема
   существовала только в прозе.
2. **Она устойчива.** Позиционный идентификатор кодирует место документа в
   списке файлов, поэтому вставка нового экрана переименовывает соседние.
3. **Позиционная схема уже сломалась на практике.** `11-parent-rewards.md`
   нёс сразу два идентификатора — `UX-PAR-05 / UX-CHI-06`, — потому что
   один экран обслуживает обе поверхности, а позиционное пространство имён,
   разделённое по поверхностям, этого выразить не может.

Границы экранов при этом **не пересматривались**. Там, где два уровня
документации расходились в том, один это экран или два (чат, награды),
принят ответ документа, написанного по шаблону: он утверждает это явно
(`social-chat.md`: «Parent chat, child chat and permitted family/group chat
use the same conversation model with different policies»).

## Два уровня канонических идентификаторов

| Уровень | Что это значит | Где перечислен |
| --- | --- | --- |
| `SCREEN_IDS` | Контракт заморожен по `screen-contract-template.md` | `packages/ux-contracts/src/screens.ts` |
| `SPECIFIED_SCREEN_IDS` | Имя канонично, контракта по шаблону ещё нет | `packages/ux-contracts/src/screen-id-registry.ts` |

Второй уровень существует, чтобы пространство имён было полным: экран не
должен получать второе имя только потому, что Фаза 1 до него не дошла.

## Таблица соответствия

| Прежний ID | Канонический ID | Уровень | Документ-владелец |
| --- | --- | --- | --- |
| `UX-PAR-01` | `P-REGISTRATION` | specified | `screens/01-parent-registration.md` |
| `UX-FAM-01` | `P-FAMILY-SETUP` | specified | `screens/02-family-setup.md` |
| `UX-CHI-01` | `P-CHILD-PROFILE` | specified | `screens/03-child-profile.md` |
| `UX-CHI-02` | `C-TODAY` | frozen | `screens/child-today.md` |
| `UX-CHI-03` | `C-TASK` | frozen | `screens/child-task-detail.md` |
| `UX-CHI-04` | `C-VERIFICATION` | specified | `screens/06-child-verification.md` |
| `UX-CHI-05` | `C-CAMERA` | frozen | `screens/camera-exercise.md` |
| `UX-PAR-02` | `P-DASH` | frozen | `screens/parent-dashboard.md` |
| `UX-PAR-03` | `P-TASK-BUILDER` | frozen | `screens/parent-task-builder.md` |
| `UX-PAR-04` | `P-APPROVALS` | frozen | `screens/parent-approvals.md` |
| `UX-PAR-05` / `UX-CHI-06` | `P-REWARDS` | frozen | `screens/parent-rewards.md` |
| `UX-SOC-01` | `P-SOCIAL` | specified | `screens/12-social-parent.md` |
| `UX-SOC-02` | `C-FRIENDS` | specified | `screens/13-child-friends.md` |
| `UX-SOC-03` | `SOCIAL-CHAT` | frozen | `screens/social-chat.md` |
| `UX-SOC-04` | `P-CHAT` | specified | `screens/15-chat-parent.md` |
| `UX-GAM-01` | `C-GAME-LOBBY` | frozen | `screens/game-lobby.md` |
| `UX-PAR-06` | `P-SETTINGS` | specified | `screens/17-parent-settings-safety.md` |

Машиночитаемая версия — `RETIRED_SCREEN_IDS` в
`packages/ux-contracts/src/screen-id-registry.ts`. Старая ссылка из тикета
или дашборда разрешается через `resolveScreenId()`, а не превращается в
тупик.

## Что стало с ранними набросками

Девять экранов имеют и ранний набросок, и контракт по шаблону. Наброски
не удалены — они остаются источником продуктовых требований на русском, —
но перестали объявлять идентификатор: вместо `**ID:**` в них стоит
`**Канонический контракт:**` со ссылкой на документ-владелец. При
расхождении побеждает контракт.

## Правила

1. Новый экран получает семантический идентификатор с префиксом
   поверхности: `C-` (ребёнок), `P-` (родитель), `SOCIAL-` (общий
   социальный контур).
2. Идентификатор объявляет ровно один документ. Это проверяется тестом,
   а не соглашением.
3. Идентификатор не переиспользуется и не переуказывается: `RETIRED_SCREEN_IDS`
   пополняется, но не переписывается — иначе смысл старой ссылки меняется
   молча.
4. Прежде чем экран попадёт в `SCREEN_IDS`, у него должен быть контракт по
   `screen-contract-template.md`.

Проверки живут в `packages/ux-contracts/test/screens.test.ts`: каждый
прежний идентификатор разрешается в канонический, пространство имён без
дубликатов, каждый документ объявляет канонический идентификатор и каждый
канонический идентификатор объявлен ровно одним документом.
