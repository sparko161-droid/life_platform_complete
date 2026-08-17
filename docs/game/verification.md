# Verification Engine

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## Strategies
MANUAL_SELF, PARENT_APPROVAL, PHOTO_PROOF, VIDEO_PROOF, CAMERA_EXERCISE, TIMER, COUNTER, AUDIO_PROOF, ALICE_SESSION, COMPOSITE.

## Result
A verification result records strategy, status, confidence where applicable, evidence references, verifier, timestamps and reason for rejection.

## Manual-first
Every automated strategy has a fallback path where policy allows. Low confidence should route to human approval, not fabricate success.

## Camera privacy
Process frames locally by default. Send only derived result data unless the user explicitly submits a video/photo task.

## Reward rule
Rewards are issued only after completion state is authoritative and idempotent.
