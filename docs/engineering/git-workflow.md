# Git Workflow

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## Branches
`main`: releasable.
`develop`: optional integration branch only if release cadence needs it.
`feature/*` and `agent/*`: short-lived work.

## PR
Small, focused PRs. One logical change. Required checks must pass.

## Merge
Prefer squash merge for feature branches. Preserve ADR/decision commits when useful.

## Parallel work
Shared contract tasks are merged before dependent implementation where possible. Rebase or merge main before final gate.

## No force push
Do not rewrite shared branches.
