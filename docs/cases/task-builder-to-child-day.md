# Case: Task Builder → Child Day

**Actors:** Parent, Child
**Domains:** Task, Scenario, Daily Load, Rewards

1. Parent chooses template or creates task.
2. Builder validates schedule, verification, permissions and reward.
3. Parent previews estimated daily load.
4. Assignment is created for the selected child.
5. Child sees the task in the correct day/scenario position.
6. Completion follows the configured verification strategy.
7. Trusted completion emits events for rules and rewards.

## Edge cases

Disabled task, schedule conflict, duplicate assignment, timezone change and expired task must not create duplicate rewards.