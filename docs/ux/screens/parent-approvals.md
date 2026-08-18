# Parent — Approvals

**Screen ID:** P-APPROVALS
**Owner:** Parent Experience Lead + Verification Lead
**Review:** QA + Security

## Purpose
Let a parent review a task submission that needs a human decision and record that decision once, with no way to accidentally double-reward or silently rewrite history.

## Data
Child, task, what the child submitted (evidence reference, not raw media inline where policy restricts it — see `docs/security/privacy.md`), time of submission, a hint of what to check, and prior decisions on the same assignment if any.

## Actions
«Подтвердить» → `task.approval.approve` → completion confirmed → reward processing (`P-DASH`).
«Попросить повторить» → `task.approval.return` → correction requested, with a short comment → child sees a retryable state (`C-TASK`).

## States
New review, already viewed, approved, return requested, submit error.

## Rules
- Re-confirming the same completed attempt does not grant the reward a second time — approval is idempotent per assignment, not per click (`docs/architecture/commands-and-idempotency.md`).
- A parent never edits history after the fact; a correction is a new, separately visible record, not a silent overwrite (`docs/architecture/concurrency-and-conflicts.md`'s "no destructive edits" principle, same one `docs/game/rewards.md` applies to reward reversals).
- Only the evidence needed for this decision is shown; other children's data never appears here.

## Language
Russian only. «Подтвердить», «Попросить повторить» are the only two decision verbs — no synonyms, so QA/e2e text matching stays stable.

## Acceptance
A parent can review one submission end to end using only this screen, and after the decision both the parent's history and the child's task state reflect it without a database edit.
