# Implementation: Phase 0 Docs/Task Traceability

## Scope

`docs/planning/phases/phase-0.md`'s exit criterion: "Human Architect sees
only unresolved decisions," and its Outputs line's "docs graph." P0-012,
the last of the twelve Phase 0 tasks.

## Two separate problems, both real, both found by running a checker rather than assuming the docs were fine

### 1. `docs/DOCS_GRAPH.md` had drifted from the real `docs/` tree

`MASTER_SPEC.md` calls `DOCS_GRAPH.md` the index: "Detail stays in short
authoritative files." Nothing checked it against reality. `scripts/check-docs-graph.mjs`
does two things:

- Every backtick-quoted `*.md` path (and `dir/*.md` wildcard, and bare
  `dir/` reference) in `DOCS_GRAPH.md` must exist under `docs/`.
- Every real `.md` file under `docs/` must be referenced by `DOCS_GRAPH.md`
  somehow (exact path, a wildcard, a directory reference, or be a `README.md`
  / one of the three root index files, which document their own directory
  rather than needing a separate listing).

Run cold against the actual repo, before any fix: **74 problems.** Two dead
references (`game/reward-redemption.md`, a duplicate
`game/completion-reward-chain.md` — the real file lives under `mechanics/`
and is correctly listed there already), and 63 real docs that existed but
were never indexed. Almost all of the gap was six entire sections that
arrived during Phase 0 execution and were never added to the graph:
`docs/engineering/`, `docs/implementations/`, `docs/planning/`'s
non-phase files, `docs/governance/`, `docs/learning/`, `docs/platform/`.
Fixed by adding two new `DOCS_GRAPH.md` sections (Engineering,
Implementations) and extending five existing ones, rather than by loosening
the check to tolerate the gap.

### 2. Task-id references can silently point at nothing

Docs and task files mention task ids in prose (`P0-005`, `P1-014`, ...).
Nothing verified those ids still exist — a task getting renamed or a typo
in a doc would go unnoticed. The same script extracts every `P<phase>-<NNN>`
token from `docs/`, `tasks/`, and `AGENTS.md`, and checks it against the
real ids in `tasks/registry.yaml` (read via a fixed-format regex,
`^\s*-\s*id:\s*(\S+)`, matching exactly what `saveRegistry()` always writes
— deliberately not a full YAML parse, to avoid a new dependency for a
single small script). Files with `template` in their path are exempt
(`tasks/discoveries/0000-template.yaml` intentionally holds a placeholder
`source_task` id that isn't a real task).

Verified the checker actually catches drift, not just passes trivially, by
injecting each of the three failure modes it's meant to catch (a removed
`DOCS_GRAPH.md` entry, an added dead reference, an added bad task-id
reference) and confirming each one fails with the right message, before
wiring it into CI as "Docs graph and task references are in sync"
(`.github/workflows/ci.yml`, `pnpm run docs:check`).

## "Human Architect sees only unresolved decisions"

The registry already tracked three kinds of thing a human might need to
weigh in on, but nothing surfaced them together: a task's `*_BLOCKED`
status (with `blocked_reason`), a `human_decisions` entry whose `decision`
is still `null`, and a `discovery_links` entry marked `blocking`.
Finding any of these meant reading the whole 58-task registry by eye.

`task-registry decisions` (`registry.ts`'s `outstandingDecisions()`) lists
exactly those three things and nothing else. Run against the live registry
today: "No outstanding decisions" — genuinely true, not a placeholder
response; the registry currently has zero blocked tasks, zero unresolved
`human_decisions` entries, and zero blocking discoveries. The command's
value is for when that stops being true.

## What this doesn't do

- It doesn't parse markdown link syntax (`[text](path)`) -- a survey of the
  repo found none in actual use; every cross-reference is a backtick-quoted
  bare path in prose, which is what the checker parses.
- It doesn't validate the *content* of a doc against the *content* of a
  task (e.g., that a doc's described behavior matches what a task actually
  shipped) -- that's a QA/architecture-review concern, not a traceability
  one.
- `human_decisions`/`discovery_links.blocking` still have to be recorded by
  a human or reviewing agent in the first place; this surfaces what's
  recorded, it doesn't detect an unrecorded decision that should exist.
