# @life/tools-task-registry

CLI over `tasks/registry.yaml`, implementing the task lifecycle from
`docs/ai-team/task-lifecycle.md` and the required capabilities from
`docs/implementations/phase-0-task-registry.md` (claim, handoff, block,
reassign, add discovery, create child task, close).

## Usage

From the repo root:

```bash
pnpm task-registry -- <command> [options]
```

Or inside this package:

```bash
pnpm dev -- <command> [options]
```

## Commands

- `list [--status S] [--phase N] [--primary role]`
- `next [--role role] [--limit N]` — tasks claimable right now (`READY`
  with every dependency `DONE`), sorted by phase then id (P0-011)
- `validate` — schema + unknown-dependency + cycle checks
- `claim <id> --agent <role>` — refuses if a dependency isn't `DONE`, or the
  task is already `IN_PROGRESS` under another agent (single-primary-executor
  rule)
- `handoff <id> --reviewer <role> [--gate-owners a,b] [--branch ...] [--files ...] [--contracts ...] [--tests ...] [--risks ...] [--decisions ...] [--next ...]`
  — moves the task to `REVIEW`, prints the fixed handoff report, and
  archives it to `tasks/handoffs/<id>.md` (P0-010 — a review can be
  reconstructed later instead of depending on terminal scrollback;
  `tasks/templates/handoff-template.md` documents the same format for
  writing one by hand)
- `block <id> --type architecture|product|security|dependency --reason "..."`
- `unblock <id> --status IN_PROGRESS|READY`
- `reassign <id> --agent <role>`
- `add-discovery <id> --type ... --finding ... --why ... --priority LOW|MEDIUM|HIGH|CRITICAL [--blocking] [--proposed-task ID]`
- `create-child-task --from-discovery DISC-ID --id NEW-ID --title "..." --primary role --phase N [--deps a,b]`
  — new task keeps `origin_discovery`/`discovered_from` links per
  `docs/ai-team/discovery-rework.md`
- `close <id> [--status DONE|NEW_TASK]` — despite the flag's default, this
  is a generic single-hop transition (it calls the same state-machine check
  as every other command), so it's also how a task under `REVIEW` walks
  forward one gate at a time: `close <id> --status QA`, then `--status
  SECURITY`, `--status ACCEPTANCE`, `--status DONE`. There's no single
  "skip to DONE" command by design — `REVIEW -> DONE` isn't a valid
  transition (see State machine below).
- `contracts validate [--file contracts/registry.yaml]` — checks
  `contracts/registry.yaml` against `packages/domain-types`'s real exports,
  `tasks/registry.yaml`'s task ids, and `docs/planning/change-log.md`'s
  headings (P0-010; see `docs/architecture/contract-registry.md`)

All commands accept `-r, --registry <path>` to point at a different YAML
file (used by tests / dry runs against a scratch copy).

Every command that mutates the registry (`claim`, `handoff`, `block`,
`unblock`, `reassign`, `add-discovery`, `create-child-task`, `close`)
serializes through a real file lock
(`tools/task-registry/src/lock.ts`, P0-011) so two agents running commands
against the same `tasks/registry.yaml` at the same time can't both "win" a
claim on the same task. `list`/`next`/`validate`/`contracts validate` are
read-only and don't take the lock.

Known limitation: `--files`/`--tests`/`--risks`/`--decisions`/`--next` on
`handoff` split on every comma, so a single item containing a comma gets
split into multiple bullets in the printed report. Use semicolons inside an
item, or pass one flag per line via a shell that supports it, until this is
tightened.

## State machine

See `src/schema.ts` for the full transition table. It implements
`BACKLOG → ANALYSIS → ARCHITECTURE_CHECK → READY → IN_PROGRESS → REVIEW →
QA → SECURITY → ACCEPTANCE → DONE`, the `REWORK` loop, the
`PASS_WITH_DISCOVERIES → DISCOVERY_TRIAGE → NEW_TASK` branch, and the four
`*_BLOCKED` states — plus `PLANNED`, a pre-`BACKLOG` holding state for tasks
in a later phase whose dependencies aren't satisfied yet (not part of
`task-lifecycle.md`; disclosed here as this tool's extension).

## Worktree helper (P0-004)

Implements `docs/implementations/phase-0-agent-worktrees.md`'s
`agent/<role>/<task-id>-<slug>` convention:

- `worktree create <id> --role <role> [--slug s] [--from branch]` — creates
  the branch and a worktree at a sibling directory
  `../<repo-name>-wt/<id>`, resolved against the *main* repository root
  (`git rev-parse --git-common-dir`) so it's stable no matter which
  worktree the command is run from.
- `worktree remove <id> [--branch b] [--force]` — refuses to remove unless
  `--branch`'s branch is merged into `main`, per "Worktree is removed only
  after merge and artifact retention"; `--force` overrides.
