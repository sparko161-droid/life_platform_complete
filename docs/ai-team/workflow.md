# AI Development Workflow

**Status:** Foundation
**Owner:** AI CTO

## Task lifecycle

BACKLOG → ANALYSIS → ARCHITECTURE_CHECK → QUESTIONS → READY → IN_PROGRESS → SELF_REVIEW → QA → ARCH_REVIEW → SECURITY → AI_CTO → HUMAN_ACCEPTANCE → DONE.

## Rule

No coding before Architecture Check for new/changed domains.

## Parallel work

Independent agents may work in parallel after shared contract approval.

## Shared contract

The task must define affected domain, API/events, data changes, UI contract and tests before parallel implementation where interfaces cross teams.

## Handoffs

Agent A hands off a branch/PR, tests and implementation notes. Agent B reviews based on artifacts, not conversation memory.

## Human escalation

Escalate only decisions that change product behavior, security boundary, public API, data ownership, core architecture or irreversible cost.
