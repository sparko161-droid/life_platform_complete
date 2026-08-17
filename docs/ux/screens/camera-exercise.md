# Child — Camera exercise screen

**Screen ID:** C-CAMERA
**Owner:** Computer Vision Lead + Frontend Lead
**Review:** Exercise Lead + QA + Child Safety

## Purpose
Let the child see how the camera detects body position, correct posture and count valid repetitions in real time.

## Data
Exercise definition, target, current count, readiness state, guidance, verification result.

## Visual feedback
Show body points/lines, visibility, target body area, counter and progress. Explain corrections in simple Russian.

## States
Permission, framing, not ready, ready, active, pause, low confidence, completed, aborted.

## Rules
Raw exercise video is not stored by default. Detection runs on device when supported. Backend receives the derived result.

## Acceptance
Child can understand why a repetition is not counted and adjust position without technical language. Completion produces one idempotent verification result.
