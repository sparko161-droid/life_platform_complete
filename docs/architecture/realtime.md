# Realtime Architecture

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## Scope
Messenger delivery, typing/read state, task status updates, game sessions and live exercise UI telemetry that must remain local should be separated.

## Transport
WebSocket gateway initially, Redis fan-out only where multiple instances require it.

## Rules
Realtime is an optimization, not the source of truth. Every critical state change is persisted transactionally before notification.

## Reconnect
Clients use connection IDs, heartbeat, backoff and last-seen cursors.

## Messages
Persist message before emitting delivery event. Client acknowledgements are separate from server acceptance.

## Games
Realtime game state is authoritative in a game session service; final results are committed as domain events.
