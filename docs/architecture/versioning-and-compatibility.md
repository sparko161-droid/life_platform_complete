# Versioning and Compatibility Policy

## Goal

Later phases must be able to evolve the platform without silently invalidating existing data or downstream consumers.

## Versioned surfaces

- REST API contract
- Domain contracts
- Domain/application events
- Persisted task/rule/reward artifacts when their interpretation can change
- Database migrations/schema
- UX contracts when client state/action semantics are consumed by automation or other clients

## Rules

1. Breaking changes require a new compatible version or an explicit Architecture Decision Record.
2. Existing persisted authoritative data must remain interpretable through a documented version/migration path.
3. Events consumed asynchronously carry enough version information to be interpreted after producer evolution.
4. Deprecation must identify consumers, owner, target removal condition and migration path.
5. Compatibility tests must run before a change is accepted as non-breaking.
6. Feature flags or equivalent controlled rollout must be used where a behavior change needs staged activation or rollback.
7. Adapters may translate external versions into canonical domain contracts; they may not create a second source of business truth.

## Phase 1 minimum

Phase 1 does not implement future versions speculatively. It must implement the metadata, migration, compatibility and review mechanisms necessary to introduce them safely later.
