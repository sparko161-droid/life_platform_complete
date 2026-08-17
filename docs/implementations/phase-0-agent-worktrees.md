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

## Tooling

`tools/task-registry` (see P0-003) implements this convention:

```bash
# from the repo root
pnpm --filter @life/tools-task-registry run dev -- worktree create P0-0NN --role backend-lead
#   creates branch agent/backend-lead/P0-0NN-<slug-from-title>
#   at a sibling directory ../<repo-name>-wt/P0-0NN
#   (slug derived from the task's title in tasks/registry.yaml; override with --slug)
#   (base ref defaults to main; override with --from <branch> for a task
#   whose dependency hasn't merged yet)

pnpm --filter @life/tools-task-registry run dev -- worktree remove P0-0NN --branch agent/backend-lead/P0-0NN-<slug>
#   refuses unless that branch is merged into main; add --force to override
#   ("Worktree is removed only after merge and artifact retention")
```

The path is always resolved relative to the *main* repository (via
`git rev-parse --git-common-dir`), not the worktree the command happens to
run from, so nested worktree-of-a-worktree paths can't happen even when one
agent's worktree spawns tooling for another task.

## Dependent tasks

A task that depends on another still-unmerged task branches from that
task's branch tip (`--from agent/<role>/<dep-id>-<slug>`), not from `main`.
Once the dependency's PR merges, rebase onto `main` before continuing.
