# Testing Strategy

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## Test pyramid
Unit tests for deterministic rules; integration tests for DB/queue boundaries; E2E for critical user journeys; visual checks for key UI surfaces; device tests for camera/native functions.

## Critical journeys
- Parent registration → child creation.
- Second parent invitation.
- Task creation → assignment → child completion → parent approval → reward.
- Photo/video evidence upload.
- Camera exercise → live count → completion.
- Friend consent → chat → moderation.
- Reward redemption.
- Delete/export child data.

## Camera fixtures
Keep curated pose/video fixtures for squat, push-up, jumping jack, plank and failure conditions. Test count stability and false positives.

## Contract tests
API, webhook and integration adapters must have contract tests.

## Definition
No PR is complete with a failing required test or an undocumented waiver.
