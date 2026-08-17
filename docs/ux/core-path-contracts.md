# Core UI path contracts

**Owner:** UI/UX Lead + Backend Lead
**Review:** QA + Architecture

## Parent-to-child task path

`PARENT_TASK_PUBLISHED`
→ child daily list refresh
→ child opens task
→ child starts attempt
→ evidence is submitted
→ verification runs
→ authoritative completion is created
→ reward is granted if rules allow
→ child sees result
→ parent sees updated status.

## Required UI states

Each transition supports: loading, ready, success, empty, rejected, failed, offline and retry.

## Child action rules

- «Начать» creates an attempt; repeat taps must not create duplicate attempts.
- «Сдать» submits evidence once; later retries reuse the same attempt.
- «Повторить» retries only a failed technical operation, not a completed reward.
- After verified completion the child cannot submit the same assignment again unless the assignment explicitly allows repeats.

## Parent approval path

`SUBMITTED`
→ parent opens approval
→ sees task, evidence and expected result
→ «Подтвердить» or «Вернуть на доработку»
→ child and ledger update
→ history record.

## Navigation rule

Every successful mutation has one primary next destination and a safe secondary path back to the previous context.

## Acceptance

A QA agent can execute the full path without using a database edit or internal endpoint directly.
