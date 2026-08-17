# UI error and recovery rules

**Owner:** UX Lead + QA Lead

## User-facing principle
Errors explain what the person can do next. They never expose technical causes.

## Categories

### Temporary
Example: network unavailable.
UI: «Не удалось подключиться. Попробовать ещё раз?»

### Validation
Example: missing required field.
UI points to the field and explains the expected value.

### Permission
UI: «У вас нет доступа к этому действию.»
Provide a safe route back.

### Business rule
Example: reward is no longer available.
UI explains the family rule in normal Russian and offers available alternatives.

### Moderation / safety
Do not reveal moderation internals. Explain the visible consequence and safe next action.

## Retry
Retries must be safe to repeat. A retry of a reward operation must not create a second reward redemption.

## Offline
Actions that can safely wait are queued locally and shown as «Ожидает отправки». Actions requiring current authority explain that an internet connection is needed.

## Acceptance
No supported user-facing state contains stack traces, provider error text, raw status codes or unexplained English terms.
