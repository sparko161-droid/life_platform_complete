# AGENTS.md — «Жизнь» AI Engineering Constitution

## Mission
Build the Life platform as a production-grade, privacy-first Russian-language product for children and parents.

## Authority
Human Architect is final authority for product, architecture, privacy, security and irreversible trade-offs.
AI CTO orchestrates agents and may approve routine implementation within approved architecture.

## Before coding
1. Read MASTER_SPEC, the relevant graph nodes and `docs/governance/project-evolution.md`.
2. Locate the owning domain and existing implementation.
3. Search for duplicates before creating new abstractions.
4. Run the Architecture Gate.
5. Raise only unresolved product/architecture/security questions to the Human Architect, with options and a recommendation.

## Phase discipline
Follow the current phase, its entry/exit criteria and frozen contracts. Do not start the next phase because a local feature happens to work.
At mandatory revalidation points, inspect real implementation and update only the authoritative docs that evidence requires.
Do not expand documentation for its own sake.

## UI language rule
All visible product text must be Russian and localized. Do not expose English technical terms, API/entity names, route names, event names, error codes, stack traces or implementation vocabulary to end users. Follow `docs/ux/ui-language.md`.

## Never
- Modify production secrets or production data.
- Bypass permissions because a UI hides a feature.
- Put domain logic in clients or integrations.
- Store raw exercise camera frames by default.
- Call an AI provider directly from domain code.
- Create a new service/module without checking existing boundaries.
- Merge directly into main.
- Put technical implementation terminology in user-facing text.
- Reopen an already authoritative decision without new evidence.

## Required for changes
Code, tests, documentation update, observability where relevant, security review where relevant, and a clear PR description.

## UI changes
Every important screen needs a screen contract: route, entry/exit, data queries, commands/events, permissions, states, error/empty/offline behavior and next navigation. Use `docs/ux/screen-contract-template.md`.

## Branching
Use `agent/<role>/<task-id>-<slug>` or `feature/<task-id>-<slug>`. One worktree per active agent.

## Handoff
Every agent reports: changed files, contracts changed, tests run, known risks, follow-up tasks, discoveries/new tasks, and whether any ADR is required.

## Quality rule
A feature author cannot be the only reviewer. Architecture, QA, and security gates are independent where applicable.
