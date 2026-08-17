# Exercise Engine

**Status:** Foundation
**Owner:** CV / Game Architect

## Goal

Count simple physical actions in real time without sending raw video to the backend by default.

## Pipeline

Camera → PoseProvider → landmarks → state machine → repetition/hold result → UI overlay → task result.

## Provider abstraction

`PoseProvider` is a replaceable interface.

Initial candidates: MediaPipe Pose Landmarker and MoveNet.

## Deterministic logic

Exercise-specific rules use angles, distances, visibility, velocity, state transitions and hysteresis.

Examples: squat, push-up, jumping jack, lunge, plank, balance.

## UI

Show skeleton/landmarks, visible-body status, rep counter, progress and corrective hints.

## Privacy

Process frames locally where practical. Persist only derived results unless the user explicitly creates a media proof.

## Testing

ExerciseEngine must accept prerecorded landmark sequences so tests do not depend on a live camera.
