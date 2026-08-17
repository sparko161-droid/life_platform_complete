# Branch Protection

**Status:** Foundation
**Owner:** AI CTO / DevOps Lead
**Depends on:** MASTER_SPEC, `docs/engineering/ci-cd.md`

## Why this is a manual step

GitHub branch-protection rules and repository settings are configured through
the GitHub REST/GraphQL API or the web UI, both of which require repository
admin credentials (a `gh auth login` session or a PAT with `repo` scope).
The coding agent operating in this repository does not hold either, so this
document specifies the exact settings — apply them once via the UI, or hand
the agent a token and it can apply them via `gh api`.

## Settings to apply — `Settings → Branches → Branch protection rules` for `main`

- **Require a pull request before merging** — on
  - Require approvals: **1** minimum
  - Dismiss stale approvals when new commits are pushed: on
- **Require status checks to pass before merging** — on
  - Require branches to be up to date before merging: on
  - Required checks (must match the job names in `.github/workflows/ci.yml`):
    - `install-lint-typecheck-test-build`
    - `gitleaks`
- **Require conversation resolution before merging** — on
- **Do not allow bypassing the above settings** — on (applies to admins too)
- **Restrict who can push to matching branches** — on, nobody (PR-only, no direct pushes; matches AGENTS.md "Never: Merge directly into main")
- **Allow force pushes** — off
- **Allow deletions** — off

## Equivalent `gh` command (once authenticated)

```bash
gh api -X PUT repos/sparko161-droid/life_platform_complete/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["install-lint-typecheck-test-build", "gitleaks"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON
```

## Verification

After applying, confirm a direct push to `main` is rejected:

```bash
git push origin HEAD:main
# expected: remote rejects with a protected-branch error
```

## Status

Not yet applied as of P0-001 (`docs/planning/phases/phase-0.md` lists this as
a required human decision alongside repository access). Tracked as an open
item on `tasks/registry.yaml`'s P0-001 handoff.
