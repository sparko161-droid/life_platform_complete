# Release Management

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## Versioning
Semantic versions for deployable apps; API versions are independent.

## Release notes
Every release records features, fixes, migrations, known issues and rollback notes.

## Feature flags
New risky behavior ships behind a flag before broad rollout.

## Rollout
Internal → pilot families → limited cohort → general availability.

## Mobile
Use TestFlight for iOS and internal/closed testing for Android before public store releases.
