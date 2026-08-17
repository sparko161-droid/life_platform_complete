# Vertical slice — API и события

## Client queries
`GET /child/today` returns authoritative task cards, progress, streak and available actions.

## Commands
`POST /tasks/{id}/start` starts an assigned task. `POST /tasks/{id}/proof` submits proof. `POST /tasks/{id}/approve` accepts a parent-review task. `POST /tasks/{id}/reject` rejects submitted proof. `POST /rewards/{id}/redeem` requests reward redemption.

## Contract rules
All commands require actor, family scope, authorization and idempotency key. Responses return authoritative aggregate state or a typed business result; clients do not infer final state from request success alone.

## Event path
TaskStarted → VerificationCompleted → TaskCompleted → RewardUnlocked → ProgressUpdated → NotificationRequested.

A rejected proof produces TaskRejected and does not emit RewardUnlocked.

## Retry behavior
A repeated command with the same idempotency key returns the original result. A repeated proof with a different key is evaluated against current task state and cannot create a second completion.

## UI wiring
Button labels are Russian user text. Frontend calls typed application operations, never raw database logic. Pending state disables duplicate submission. Success navigates from task result to the next valid child state.

## Error mapping
Permission, stale task, duplicate submission, invalid proof and unavailable reward are mapped to contextual Russian messages. Internal codes remain only in logs/telemetry.
