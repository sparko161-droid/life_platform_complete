# Vertical slice — «Задание → Проверка → Награда»

## Purpose
Prove the first end-to-end child journey before scaling any domain.

## Canonical flow
Child opens «Мой день» → opens task → starts → performs → submits proof → server verifies → completion is recorded once → reward is calculated once → progress updates → child sees result → parent receives relevant update.

## Ownership
Task owns assignment/state. Verification owns proof result. Reward owns reward calculation/redemption. Progression consumes trusted completion events. Notification consumes domain events. UI only renders authoritative state.

## Required commands
OpenToday, StartTask, SubmitProof, ApproveCompletion, RejectCompletion, RedeemReward.

## Required events
TaskStarted, VerificationCompleted, TaskCompleted, TaskRejected, RewardUnlocked, ProgressUpdated, NotificationRequested.

## Invariants
- Completion cannot be final before required verification.
- A task completion has one authoritative idempotency key.
- Reward grant cannot be duplicated by retries or repeated events.
- Parent approval is allowed only when the task policy requires it.
- Rejected proof never grants the task reward.
- UI never increments authoritative balances locally.
- Every final state is auditable.

## First verification modes
Manual self-report, parent approval, photo proof and timer. Camera exercise is added after the core slice is stable.

## Acceptance
A seeded family can run the complete journey through a real client and API without direct database edits. All state changes appear in audit/event traces and are recoverable after a repeated request or temporary network failure.
