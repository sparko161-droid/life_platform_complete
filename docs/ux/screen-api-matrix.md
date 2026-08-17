# Screen/API Matrix

**Owner:** Frontend Lead + Backend Lead

| Surface | Primary screen/action | Canonical data | Mutation/events |
|---|---|---|---|
| Child | Today | daily tasks, progress | task-completed, reward-granted |
| Child | Task detail | assignment, rules, verification | attempt/submit |
| Child | Camera exercise | exercise definition | verification-result |
| Parent | Dashboard | child summary, approvals | approve/reject |
| Parent | Task Builder | templates, rules | draft/publish/assign |
| Parent | Rewards | catalog, ledger | redeem/adjust |
| Parent | Social | parent/child graph | invite/accept/block |
| Child | Chat | conversation/messages | send/read/report |
| Parent | Chat | parent conversations | send/read/block |
| Child | Games | lobby/session | join/start/finish |
| Admin | Moderation | reports/content | review/action |

## Rule
A matrix entry is not complete until the OpenAPI operation/event name, authorization policy and empty/error states are linked from the screen spec.

## Traceability
Screen IDs should appear in E2E tests and product cases so UI changes cannot silently break user journeys.