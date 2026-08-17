# ADR-0003 On-Device Pose

**Status:** Accepted
**Owner:** Computer Vision Lead
**Depends on:** MASTER_SPEC
**Related:** docs/game/exercise-engine.md


## Decision
Exercise counting uses on-device pose estimation plus deterministic rules. Raw exercise video is not stored by default.

## Why
Lower latency, lower media risk and predictable counting logic.

## Providers
MediaPipe and MoveNet behind PoseProvider abstraction. MediaPipe currently documents continuous Android camera pose detection; provider capabilities should be revalidated at implementation time. citeturn798336search9

## Revisit when
A specific exercise cannot meet accuracy/performance requirements with local inference.
