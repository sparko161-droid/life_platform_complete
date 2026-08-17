# AI Context Management

**Status:** Foundation
**Owner:** AI CTO

## Goal

Prevent context loss by keeping knowledge granular and linked.

## Required context layers

1. Master Specification
2. Relevant domain docs
3. ADRs
4. API/event contracts
5. task-specific acceptance criteria
6. tests/fixtures

## Agent rule

Never load the entire repository by default. Start from task → graph → relevant docs → code.

## Document limit

Hard target <200 lines per doc. Split when the document becomes dense or changes independently.

## Source of truth

Architecture decision: ADR.
Business rule: product/domain spec.
API shape: OpenAPI.
Runtime behavior: tests + code.
Operational rule: infrastructure/runbook.

## Stale docs

AI agents must flag suspected stale documentation rather than silently rewriting architectural history.
