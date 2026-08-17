# Child — Today screen

**Screen ID:** C-TODAY
**Owner:** Frontend Lead
**Review:** Child Experience + QA

## Purpose
Show a small, understandable plan for today and the next motivating action.

## Data
Daily assignments, progress, active streaks, available rewards, pending friend/game invitations.

## Actions
- «Открыть задание» → task detail.
- «Продолжить» → current attempt state.
- «Посмотреть награды» → rewards.
- «Открыть приглашение» → approved social/game destination.

## States
First day, normal day, all complete, overdue, offline, no tasks, failed sync.

## Rules
Daily load must not overwhelm the child. Money is never the only progress indicator. Private parent data is hidden.

## UI language
Russian only; use child-friendly phrasing. Internal labels are prohibited.

## Acceptance
From this screen a child can reach every currently actionable activity without dead ends, and after completion the screen reflects the resulting progress/event.
