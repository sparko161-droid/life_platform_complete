# Exercise Engine

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## Pipeline
Camera → PoseProvider → landmarks → PoseOverlay → deterministic ExerciseStateMachine → result.

## PoseProvider
Abstraction supports MediaPipe and MoveNet implementations. Provider can be swapped without changing exercise rules.

## Deterministic logic
Use joint angles, distances, relative heights, velocity and state transitions. Avoid LLM decisions for repetition counting.

## Live UI
Show skeleton points, relevant joints, visibility state, repetition counter, progress and corrective guidance.

## Readiness
Before counting: body visibility, framing and required landmarks must meet thresholds.

## Exercises
Start with squat, push-up, jumping jack, lunge, plank, balance, arm raise. Add each through data-driven definitions and fixtures.
