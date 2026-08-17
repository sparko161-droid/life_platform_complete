<!--
Checklist mirrors AGENTS.md "Required for changes" and docs/ai-team/workflow.md.
Delete sections that genuinely do not apply and say why.
-->

## Summary

<!-- What changed and why, one or two sentences. -->

## Task

- Task id: <!-- e.g. P0-00X -->
- `tasks/registry.yaml` status after this PR: <!-- REVIEW / QA / ... -->

## Checklist (AGENTS.md "Required for changes")

- [ ] Code
- [ ] Tests (and they pass — paste the command/output below)
- [ ] Documentation updated
- [ ] Observability added where relevant
- [ ] Security review done where relevant
- [ ] No direct push to `main`; this is a PR from `agent/<role>/<task-id>-<slug>` or `feature/<task-id>-<slug>`

## Contracts changed

<!-- OpenAPI paths, domain types, events — or "none". -->

## Tests run

<!-- Exact commands and results. -->

## Known risks

<!-- Anything a reviewer should specifically look at. -->

## ADR required?

<!-- Yes/No. If yes, link the ADR under docs/adr/. -->
