# Vertical slice — трассировка состояний

## Child task
NOT_STARTED → IN_PROGRESS → SUBMITTED → VERIFYING → COMPLETED or REJECTED.

## Parent review
WAITING_PARENT → APPROVED or REJECTED.

## Reward
LOCKED → AVAILABLE → REDEEMING → REDEEMED, with EXPIRED/CANCELLED/FAILED as terminal alternatives where policy allows.

## UI rule
A client renders the current authoritative state and available actions. It does not derive permission to transition from local assumptions.

## Refresh/recovery
After reconnect, the client requests the current task and reward state. Local optimistic actions are reconciled against the server result. An unknown local state never grants a reward.

## Parallel actors
Parent and child may act concurrently. The server validates the current version and policy. A stale action returns a conflict result and the UI refreshes instead of silently overwriting another actor's change.

## Audit
Every terminal transition records actor, timestamp, source, aggregate version and correlation/idempotency identifiers.
