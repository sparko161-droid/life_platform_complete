# Branch Protection

**Status:** Foundation
**Owner:** AI CTO / DevOps Lead
**Depends on:** MASTER_SPEC, `docs/engineering/ci-cd.md`

## Two blockers this had, both now resolved

**Blocker 1 — the plan.** `sparko161-droid/life_platform_complete` was a
**private** repository owned by a **personal** account. On GitHub,
protected branches and rulesets are free for *public* repositories but a
paid feature for *private* ones — a personal account needs **GitHub Pro**,
an organization needs **Team**. So this was not only a credentials
problem: on the private+Free plan the settings below could not be created
at all, by anyone, including the owner. Resolved 2026-08-18: the Human
Architect chose "make public" from the options table below.

**Blocker 2 — credentials.** Applying the rules needs repo-admin auth (a
`gh auth login` session or a PAT with `repo`/`administration:write`). A
coding agent must not be handed that token — entering credentials on
someone's behalf is out of scope regardless of permission — so the
commands below were written to be run by the Human Architect in their own
terminal, which is what happened: they ran `gh auth login` themselves, and
the resulting authenticated session applied the settings.

## Options, cheapest real fix first

| Option | Cost | Enforcement | Notes |
|---|---|---|---|
| **GitHub Pro** on the personal account | ~$4/month | Full, server-side | Unlocks everything below on the private repo. Smallest change to the plan of record. |
| **Make the repo public** | free | Full, server-side | Technically safe today (no secrets committed; `gitleaks` runs in CI and is clean), but publishing the source of a child-data platform is a product/IP decision for the Human Architect, not an engineering one. Not reversible in the sense that anything published may be cached or forked. |
| **Stay private + Free** | free | None server-side; stopgaps only | What is in place today — see "Stopgaps currently active". |

## Stopgaps currently active (no plan change, no token)

Because neither of the paid options has been chosen yet, and leaving
`AGENTS.md`'s "never merge directly into `main`" rule with *zero*
enforcement was the worse option, two mechanisms are live:

- **`.githooks/pre-push`** — refuses any push whose remote ref is
  `refs/heads/main`, and prints the correct feature-branch commands.
  Client-side and bypassable with `--no-verify` by design: it stops the
  accident, not an attacker. Enable once per clone:
  `git config core.hooksPath .githooks`. Verified working — a real
  `git push origin HEAD:main` was rejected by it.
- **`direct-push-alarm`** job in `.github/workflows/ci.yml` — runs only on
  push-to-`main` events and fails when the landed commit carries no PR
  reference, so a direct push is visible in the Actions tab and in the
  owner's failure email. An alarm after the fact, not a lock.

Both are explicitly temporary. **Delete the `direct-push-alarm` job once
real branch protection is enabled** — the lock makes the alarm redundant.

## Settings to apply — `Settings → Branches → Branch protection rules` for `main`

- **Require a pull request before merging** — on
  - Require approvals: **0** — see the solo-maintainer warning below
  - Dismiss stale approvals when new commits are pushed: on
- **Require status checks to pass before merging** — on
  - Require branches to be up to date before merging: on
  - Required checks (must match the job `name:` values in `.github/workflows/ci.yml`):
    - `install-lint-typecheck-test-build`
    - `gitleaks`
- **Require conversation resolution before merging** — on
- **Do not allow bypassing the above settings** — on (applies to admins too)
- **Restrict who can push to matching branches** — on, nobody (PR-only, no direct pushes; matches AGENTS.md "Never: Merge directly into main")
- **Allow force pushes** — off
- **Allow deletions** — off

### Two traps to avoid

**Required approvals must be 0 while this is a one-human project.** GitHub
does not let you approve your own pull request. With
`required_approving_review_count: 1` *and* `enforce_admins: true`, the sole
maintainer cannot merge anything, ever — every PR needs an approving review
from a second human who does not exist. The rest of the rules (PR required,
CI green, up-to-date branch, no direct push) still deliver the actual value:
nothing reaches `main` without passing the gates. Raise this to `1` on the
day a second reviewer joins — that is the trigger, not a calendar date.
AI agents cannot satisfy it either; `docs/ai-team/agent-registry.yaml`
already forbids an agent approving or merging its own work, and a GitHub
approval from a bot account would be a way of pretending otherwise.

**Never mark `no direct pushes to main` as a required check.** That job
runs only on `push` events (`if: github.event_name == 'push'`), so on a pull
request it never reports a status at all. GitHub treats a required check
that never reports as *pending forever* and blocks the merge permanently.
Same reasoning applies to `pnpm audit` and `knip (dead code / unused
exports)`: both are `continue-on-error: true` advisory jobs, so requiring
them would either do nothing or block on advisory noise. Required means
blocking, and only the two checks listed above are blocking today.

## Equivalent `gh` command — run this yourself

The Human Architect runs these three commands in their own terminal. `gh`
is already installed at `~/dev-tools/bin/gh.exe` but unauthenticated;
`gh auth login` opens a browser flow, so it has to be a human doing it.

```bash
gh auth login
```

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
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON
```

```bash
gh api repos/sparko161-droid/life_platform_complete/branches/main/protection --jq '{checks: .required_status_checks.contexts, admins: .enforce_admins.enabled, approvals: .required_pull_request_reviews.required_approving_review_count}'
```

If the second command returns **HTTP 403 with "Upgrade to GitHub Pro"**,
that is Blocker 1 above, not a bad token — pick an option from the table.

## Verification

After applying, confirm a direct push to `main` is rejected:

```bash
git push origin HEAD:main
# expected: remote rejects with a protected-branch error
```

## Status

**Applied 2026-08-18.** The Human Architect chose "make public" from the
options table, then ran `gh auth login` under their own account. The exact
`gh api` command in this doc was then run and returned the protection
object back with every setting matching what's specified above.

Verified for real, not just by trusting the API response: a genuine direct
push to `main` (a throwaway empty commit) was rejected by GitHub with
`GH006: Protected branch update failed for refs/heads/main. Changes must be
made through a pull request. 2 of 2 required status checks are expected.`
— exactly the "Verification" section below predicted.

`.githooks/pre-push` and the `direct-push-alarm` CI job are now redundant
(server-side protection makes both stopgaps unnecessary) but were left in
place rather than removed in the same change that applied protection —
removing a safety mechanism and proving its replacement works should not
happen in one uninspected step. Safe to remove in a follow-up.

`docs/engineering/phase-0-checklist.md`'s two related items are now
checked.
