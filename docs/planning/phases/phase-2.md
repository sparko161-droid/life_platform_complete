# Phase 2 — Game Loop and PWA

## Objective
Turn the core task loop into a compelling daily game.

## Core domains

XP, levels, coins, streaks, achievements, skills, quests, scenarios, child game shell.

## Responsible

Game Design Lead: economy/progression. Frontend Lead: child experience. Backend Lead: game services. QA Lead: progression tests.

## Parallel streams

C1 Economy, C2 Progression, C3 Quest engine, C4 Child game UI, C5 Parent dashboard, C6 analytics.

## Contracts

GameEvent, XPTransaction, CoinTransaction, Streak, Achievement, Quest, RewardUnlock.

## Exit criteria

A child can complete a coherent 7-day loop, see progress, redeem at least one configured reward and parents can audit the full history.
