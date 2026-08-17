# Testing Strategy

**Status:** Foundation
**Owner:** QA Lead

## Test pyramid

1. Unit — domain rules and pure functions.
2. Integration — DB, queues, auth, storage adapters.
3. API contract — OpenAPI and permission behavior.
4. E2E — real user journeys.
5. Device tests — Android/iOS critical paths.

## Camera test strategy

Store deterministic fixture inputs for squat, push-up, jump, plank, invalid visibility, side view, low light and partial body.
ExerciseEngine must be testable from landmark sequences without a camera.

## Required user journeys

- parent registration
- child creation
- second parent invitation
- task creation
- child completion
- parent approval
- photo/video proof
- camera exercise
- reward redemption
- friendship
- child chat
- parent chat
- parental chat visibility setting
- mini app auth
- Alice account linking

## Definition

A feature is not complete because a happy-path E2E passes. Edge cases, permission boundaries and failure recovery are part of acceptance.
