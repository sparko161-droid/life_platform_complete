# Case: Camera Exercise Verification

## Actor
Child with tablet/phone camera.

## Path
Open task → camera readiness → body overlay → start → live counter → guidance → target reached → verification result.

## UX
Show landmarks, skeleton, visibility, counter and actionable correction.

## Technical rule
On-device pose inference where supported; deterministic state machine counts reps.

## Fallback
Low confidence or unsupported device → parent approval/manual mode.

## Data
Store derived result by default, not raw frames.
