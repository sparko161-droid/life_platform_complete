# API Contracts

**Status:** Foundation
**Owner:** Backend Lead

## Rules

REST API is the baseline external contract.
OpenAPI is the machine-readable contract.
Client SDK/types are generated or derived from the contract where practical.

## Versioning

Public API uses `/api/v1/...`.
Breaking changes require a new version or explicit migration strategy.

## Response principles

- stable error codes;
- request correlation id;
- pagination for collections;
- idempotency for retryable commands;
- explicit authorization errors;
- no accidental leakage of child/private fields.

## Domain command examples

`POST /api/v1/task-completions`
`POST /api/v1/task-assignments/{id}/approve`
`POST /api/v1/rewards/{id}/redeem`
`POST /api/v1/friendships`
`POST /api/v1/messages`
`POST /api/v1/game-sessions`

## Internal rule

Controllers validate transport data and call application services. Controllers do not implement domain rules.
