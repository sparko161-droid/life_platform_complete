# Implementation Map

## Layer order

1. Domain model
2. Application services
3. API/realtime contracts
4. Persistence
5. Jobs/events
6. Client adapters
7. UX/game presentation
8. Integration adapters

## Rule

No UI-only implementation of domain behavior. No adapter owns business state.

## Feature vertical slice

Every meaningful feature should map to:

- domain object/event
- application service
- API contract
- persistence
- test fixtures
- user journey
- observability
- documentation

## Example: camera squat

ExerciseDefinition → PoseProvider → ExerciseEngine → VerificationResult → TaskCompletion → GameEvent → XP/Reward → Notification.

## Example: parent friendship

ParentProfile → FriendshipRequest → PermissionPolicy → Friendship → Conversation → Notification → Audit.

## Example: case marketplace

SuccessCase → Template → Moderation → Catalog → FamilyCopy → Assignment → Completion analytics.
