# Concurrency and conflicts

**Owner:** Chief Architect + Backend Lead

The server is authoritative when two actors change the same business fact concurrently.

## Default strategy
Use optimistic version checks for mutable aggregates and return an explicit conflict when the submitted version is stale.

## Examples
- Two parents approve one completion: only one canonical approval effect.
- Reward deleted while child redeems: redemption is accepted or rejected atomically by current reward state.
- Friendship blocked while a message is sent: message policy uses the current access state.
- Task edited while child is working: the active assignment keeps its resolved task version unless policy explicitly allows migration.
- Game session expires while a player submits: server returns session-expired and no late result is committed.

## UI rule
Show a human-readable conflict message and offer refresh/retry where safe. Never silently overwrite another user's change.

## Audit
Conflict decisions that affect money, permissions, child safety or durable progress are auditable.

## Acceptance
Concurrent integration tests cover parent-parent, parent-child and child-child races for critical aggregates.