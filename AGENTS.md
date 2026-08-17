# AGENTS.md — «Жизнь» AI Engineering Constitution

## Mission
Build the Life platform as a production-grade, privacy-first Russian-language product for children and parents.

## Authority
Human Architect is final authority for product, architecture, privacy, security and irreversible trade-offs.
AI CTO orchestrates agents and may approve routine implementation within approved architecture.

## Before coding
1. Read MASTER_SPEC and the relevant graph nodes.
2. Locate the owning domain and existing implementation.
3. Search for duplicates before creating new abstractions.
4. Run the Architecture Gate.
5. Raise only unresolved product/architecture/security questions to the Human Architect, with options and a recommendation.

## Never
- Modify production secrets or production data.
- Bypass permissions because a UI hides a feature.
- Put domain logic in clients or integrations.
- Store raw exercise camera frames by default.
- Call an AI provider directly from domain code.
- Create a new service/module without checking existing boundaries.
- Merge directly into main.

## Required for changes
Code, tests, documentation update, observability where relevant, security review where relevant, and a clear PR description.

## Branching
Use `agent/<role>/<task-id>-<slug>` or `feature/<task-id>-<slug>`. One worktree per active agent.

## Handoff
Every agent reports: changed files, contracts changed, tests run, known risks, follow-up tasks, and whether any ADR is required.

## Quality rule
A feature author cannot be the only reviewer. Architecture, QA, and security gates are independent where applicable.
