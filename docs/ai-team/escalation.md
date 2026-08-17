# AI Escalation Rules

**Status:** Foundation
**Owner:** Human Architect

## Ask the human when

- requirements conflict;
- architecture is undefined;
- more than one valid architecture has materially different consequences;
- privacy/security boundary changes;
- public API changes;
- data ownership changes;
- feature may violate product principles;
- irreversible operational/cost decision appears;
- legal interpretation is required.

## Do not ask the human when

- naming is obvious;
- local refactor is safe;
- existing pattern already decides the question;
- test implementation is straightforward;
- formatting/tooling is routine.

## Escalation format

Question → known facts → missing decision → options A/B/C → recommendation → consequences → proposed default.

## Desired human experience

Human should receive decisions, not noise.
