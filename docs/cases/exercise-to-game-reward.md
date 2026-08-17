# Case: Exercise → Game → Reward

**Actors:** Child, Parent
**Domains:** Exercise, Verification, Task, Game, Reward

1. Child opens an exercise mission.
2. Camera readiness checks framing and required landmarks.
3. Pose overlay shows the skeleton and guidance.
4. Exercise engine counts valid repetitions locally.
5. Verification result is sent with count, quality and confidence.
6. Trusted completion emits a game event.
7. Game effect updates the mission; reward is evaluated once.

## Failure

Low confidence or lost landmarks pauses counting and explains how to reposition. Parent approval is the fallback when policy allows it.