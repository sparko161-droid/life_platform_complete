# Implementation: Phase 0 AI Task Orchestration

## Scope

`docs/planning/phases/phase-0.md`'s exit criterion: "AI agents can claim,
branch, hand off and review." P0-003/P0-004 built the individual commands;
this (P0-011) is what makes running several of them **concurrently** safe,
and makes "what should I work on" answerable without reading the whole
registry by eye.

## The problem this closes

`tools/task-registry` already had `claim`/`handoff`/`block`/`unblock`/
`reassign`/`add-discovery`/`create-child-task`/`close` (P0-003) and
`worktree create`/`remove` (P0-004). Every mutating command did a plain
`readFileSync` → modify → `writeFileSync` on `tasks/registry.yaml` with no
locking. That's fine for one agent at a time, but this repo's whole model is
several AI agents working in parallel worktrees — and nothing prevented two
of them from claiming the same task at once.

This was reproduced for real before being fixed: two Node processes running
`task-registry claim P1-009 --agent X` / `--agent Y` against the same
scratch registry simultaneously **both printed success**, and the registry
was left with whichever write landed last — a silent violation of
`docs/ai-team/task-lifecycle.md`'s "every active task has one responsible
executor."

## The fix

`tools/task-registry/src/lock.ts`: `withRegistryLock(registryPath, fn)`
wraps a critical section in an advisory lock — a directory
(`tasks/.registry.yaml.lock`) created with `mkdirSync`, which is atomic on
both POSIX and NTFS, so it's a real mutex rather than a check-then-act race
of its own. A second acquisition attempt retries (50ms backoff) until the
first releases or a 10s timeout elapses. A lock directory older than 30s is
treated as abandoned (a crashed process) and cleared rather than blocking
forever.

Every mutating CLI command now runs its read-modify-write inside
`withRegistryLock`. Read-only commands (`list`, `validate`, `next`,
`contracts validate`) don't need it.

Re-running the same two-process race against the fixed CLI: one call
succeeds, the other correctly fails with `"P1-009 is already IN_PROGRESS
under primary ..."` — the exact error a sequential double-claim would
produce, which is the point: concurrency safety should make races collapse
into the same outcome as if they'd happened one after another, not silently
succeed twice.

## A second bug found building the first fix: Node's recursive `rmSync` on Cyrillic paths

The first version of the lock released with `rmSync(lock, { recursive:
true, force: true })`. Running real `close`/`handoff` commands against the
actual repo, that call returned successfully (no exception, exit code 0,
the task's status update visibly saved) but the lock directory was still
on disk afterward — every single time, not intermittently. The next
command would then wait out the full 10s timeout against a lock nothing
was still holding.

Bisected with a bare Node script, no tsx or CLI involved: `rmSync(dir, {
recursive: true, force: true })` silently failed to remove a directory
under `C:\Users\Kuvshinov\Desktop\Работа\...` (this repo's real path — it
has a Cyrillic folder in it) but worked immediately and correctly against
an otherwise-identical ASCII sibling path. The two syscalls `rmSync`'s
recursive mode composes — `unlinkSync` on the one file, then `rmdirSync`
on the now-empty directory — worked correctly on the *same* Cyrillic path
in the same script. So `lock.ts` calls those two directly
(`removeLockDir()`) instead of the recursive helper, in both `release()`
and the stale-lock cleanup path in `acquire()`. Confirmed with 8
consecutive real CLI invocations against the live repo after the fix: zero
leaked locks, versus every single one before it.

This is a Node.js/Windows-specific bug (observed on Node v24.11.1), not a
project misconfiguration, and it isn't scoped to this lock — any code
anywhere using `rmSync`/`rm -rf`-style recursive removal on a path under
this repo's Cyrillic-containing directory could hit it silently. Checked
the rest of the repo for other recursive-removal call sites at the time
this was found: none outside this file (`scripts/db-backup.mjs`,
`worktree.ts`'s `git worktree remove`, etc. don't use `fs.rmSync`).
Worth re-checking if a future change adds one.

## Task discovery

`task-registry next [--role <role>] [--limit N]` lists tasks that are
`READY` with every dependency `DONE`, sorted by phase then id. Before this,
finding claimable work meant running `list --status READY` and manually
checking each task's `deps` against their current status. The filter logic
lives in `registry.ts`'s exported `claimableTasks()` so it's unit-tested
independent of the CLI.

## The orchestration loop this enables

For one agent working one task, end to end:

```bash
pnpm task-registry -- next --role backend-lead
pnpm task-registry -- claim P1-005 --agent backend-lead
pnpm task-registry -- worktree create P1-005 --role backend-lead
# ... do the work in the created worktree ...
pnpm task-registry -- handoff P1-005 --reviewer chief-architect \
  --branch agent/backend-lead/P1-005-media-evidence \
  --files "..." --contracts "..." --tests "..." --risks "..." --next "..."
# reviewer runs the gates, then:
pnpm task-registry -- close P1-005 --status QA
pnpm task-registry -- close P1-005 --status SECURITY
pnpm task-registry -- close P1-005 --status ACCEPTANCE
pnpm task-registry -- close P1-005 --status DONE
pnpm task-registry -- worktree remove P1-005
```

Multiple agents can run their own `next`/`claim`/`handoff` loops against the
same `tasks/registry.yaml` at the same time now — the lock is what makes
that a supported use case instead of an unrecognized hazard.

## What this does not do

- It does not pick work *for* an agent or enforce role-appropriateness
  beyond the optional `--role` filter on `next` — an agent (or the AI CTO)
  still decides what to claim.
- It does not replace the merge-gate.md review sequence; `close --status
  QA/SECURITY/ACCEPTANCE/DONE` moves the state machine forward, it doesn't
  perform the review itself.
- The lock only protects `tasks/registry.yaml`. Two agents editing the same
  application file in parallel branches is a normal merge conflict, handled
  by the branch/worktree/PR model, not by this lock.
