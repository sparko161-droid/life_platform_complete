# Event Architecture

**Status:** Foundation
**Owner:** Backend Lead

## Why

Events decouple task completion from rewards, notifications, analytics, achievements and future mechanics.

## Event shape

```text
id
name
version
occurred_at
actor_id
family_id
child_id
correlation_id
causation_id
payload
```

## Rules

1. Events are immutable facts.
2. Event names are stable.
3. Payload changes require versioning.
4. Consumers must be idempotent.
5. Domain events must not contain unnecessary child data.

## Initial events

- task.assigned
- task.started
- task.completed
- task.approved
- task.rejected
- reward.granted
- reward.redeemed
- streak.updated
- achievement.unlocked
- friendship.created
- message.sent
- game.session.started
- game.session.finished
- learning.session.completed

## Implementation

Initial async transport: BullMQ/Redis.
Domain events should be published through an internal abstraction so transport can change later.
