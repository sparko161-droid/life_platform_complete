# Domain Events

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## Event envelope
`eventId`, `eventType`, `occurredAt`, `actorId`, `familyId`, `childId?`, `aggregateId`, `version`, `payload`.

## Initial events
TASK_ASSIGNED, TASK_STARTED, TASK_COMPLETED, TASK_APPROVED, TASK_REJECTED, VERIFICATION_COMPLETED, XP_GRANTED, COINS_GRANTED, MONEY_LEDGER_POSTED, REWARD_UNLOCKED, REWARD_REDEEMED, STREAK_UPDATED, ACHIEVEMENT_UNLOCKED, FRIENDSHIP_CHANGED, MESSAGE_SENT, GAME_STARTED, GAME_FINISHED, NOTIFICATION_REQUESTED.

## Delivery
At-least-once delivery is assumed. Consumers must be idempotent.

## Outbox
Transactional changes that publish events use an outbox pattern before scale-out.

## PII rule
Events should contain identifiers and minimal payload; sensitive content should be fetched through authorized services when necessary.
