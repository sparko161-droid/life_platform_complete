# Time and calendar

**Owner:** Chief Architect + Backend Lead

## Authority
Server time is authoritative for durable deadlines and state transitions. Each family has a configured time zone used for its calendar day.

## Rules
- `today` for family tasks is calculated in the family time zone.
- Client displays local time but sends timestamps in a standard absolute format.
- Day boundaries are defined by the family time zone, not device clock.
- Recurring tasks generate assignments according to the family calendar.
- Streaks use consecutive family-calendar days.
- Deadline crossing is evaluated by server time.
- Notifications store intended local delivery time plus time zone.
- Historical records keep their original absolute timestamp.

## Edge cases
Handle daylight-saving transitions, clock drift, offline completion, midnight crossing and travel by using stored time zone + server timestamp.

## Acceptance
A test can reproduce task generation and streak behavior around midnight and time-zone changes without changing application code.