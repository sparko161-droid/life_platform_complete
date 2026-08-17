# Vertical slice — карта ответственности

## Backend / domains
Backend Lead owns Task command/query contracts. Game Engine Lead owns reward/progression invariants. QA owns fixtures and end-to-end validation. Security owns authorization and policy review.

## Frontend
Frontend Lead owns navigation and state rendering. UI/UX Lead owns screen contracts and Russian wording. Frontend never implements reward/permission business rules locally.

## Reviews
Architecture Reviewer checks domain boundaries and contract compatibility. Code Quality checks duplication and maintainability. Security checks scope and authorization. Journey Agent checks child and parent paths. AI CTO resolves cross-agent conflicts before Human Architect review.

## Handoff package
Each stream delivers changed files, contract versions, tests, risks, open Discoveries and exact downstream assumptions.

## Synchronization points
1. Contract freeze before parallel implementation.
2. API/client generation after contract freeze.
3. Integration after domain + UI streams complete.
4. QA after integration.
5. Architecture/security review before merge.
