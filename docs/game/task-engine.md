# Task Engine

**Status:** Foundation
**Owner:** Game/Domain Architect

## Task model

TaskTemplate → TaskAssignment → TaskAttempt/Completion → VerificationResult → Reward/Event.

## Builder blocks

Content
Schedule
Verification
Conditions
Reward
Gameplay
Notifications

## Verification types

MANUAL_SELF
PARENT_APPROVAL
PHOTO_PROOF
VIDEO_PROOF
CAMERA_EXERCISE
TIMER
COUNTER
AUDIO_PROOF
COMPOSITE

## Recurrence

ONCE, DAILY, WEEKLY, CUSTOM, STREAK, EVENT_DRIVEN.

## Parent flexibility

Parents can use catalog templates, clone them, edit local copies, disable them, or create custom tasks.

## Marketplace principle

Global templates are immutable versions. Family edits create a copy, never mutate the global source.

## AI rule

AI can draft tasks. Parent or authorized system workflow must approve activation.
