# Scenario Engine

**Owner:** Task/Domain Architect

A scenario is a reusable time/context bundle that assembles tasks, quests, reminders and optional rewards.

## Examples
`WEEKDAY_MORNING`, `EVENING`, `WEEKEND`, `SCHOOL_DAY`, `HOLIDAY`, `SPORT_DAY`.

## Rules
- Scenario selects templates; family copies remain editable.
- Timezone and child schedule are explicit inputs.
- Conflicts produce recommendations, not silent overwrites.
- Parent can disable or replace any recommended step.

## Acceptance
Parent can apply a scenario, preview the resulting day, edit steps and activate it without creating duplicate task assignments.