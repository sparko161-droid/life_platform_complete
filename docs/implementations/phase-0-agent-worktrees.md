# Implementation: Agent Worktrees

## Goal
Allow multiple AI agents to work in parallel without sharing dirty working directories.

## Convention
One task = one branch/worktree.

Example: `agent/backend/P1-002-task-model`.

## Rules

No force-push to protected branches. No agent merges its own work. Worktree is removed only after merge and artifact retention.

## Handoff
Provide branch, commit, changed files, tests, contract version, discoveries and next tasks.
