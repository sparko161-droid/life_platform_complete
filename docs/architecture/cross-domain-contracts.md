# Cross-domain contracts

**Owner:** AI CTO + Chief Architect

Cross-domain behavior is coordinated by commands, canonical events and read contracts.

## Example: task completion
`CompleteTask` → Task/Verification → `TaskCompleted` / `VerificationCompleted` → Progression, Reward, Streak, Notification, Analytics.

## Example: camera exercise
`SubmitExerciseResult` → Exercise Verification → trusted result → Task completion flow. Camera never grants rewards directly.

## Example: reward redemption
`RedeemReward` → Reward/Economy validation → `RewardRedeemed` → Ledger/notification/UI refresh.

## Example: friendship
`AcceptFriendship` → Social policy check → `FriendshipChanged` → Notification/visibility/game availability.

## Example: message
`SendMessage` → Messenger policy/moderation → `MessageSent` or restricted result → realtime delivery/notification.

## Example: learning
`CompleteLearningSession` → Learning → evidence/result → Development Profile → recommendation event.

## Rules
- Commands enter through an owning application service.
- Events describe completed facts, not requests.
- Consumers are idempotent.
- Cross-domain database writes are forbidden.
- UI updates from authoritative response/event, not local assumptions.
- A new cross-domain link requires an owner, contract and failure behavior.

## Acceptance
Any feature touching two or more domains has an explicit dependency path and named event/command contracts before parallel implementation.