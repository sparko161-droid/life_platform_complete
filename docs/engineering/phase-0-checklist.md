# Phase 0 Checklist

- [ ] Git remote created and branch protection configured. Remote: done. Branch protection: exact settings documented in `docs/engineering/branch-protection.md`, not applied yet — needs GitHub repo-admin credentials no coding agent holds.
- [ ] Owner accounts and AI service identities separated. Human/org action (GitHub org membership, bot vs. human accounts) — not something a coding agent can execute; see `docs/engineering/branch-protection.md`'s note.
- [x] Dev/Stage/Prod environments defined. Config model (env vars, Doppler config mapping, promotion flow) in `docs/engineering/environments.md`. `stg`/`prd` are *defined*, not yet *provisioned* — hosting provider is a separate, still-open human decision (`docs/planning/phases/phase-0.md`'s "Human decisions").
- [x] Docker Compose local stack verified on developer machine. Real docker compose up + health-check cycle, P0-002.
- [x] PostgreSQL migration tooling selected. `node-pg-migrate`, `services/api/migrations/`; up/down/up verified against the live stack, see `docs/architecture/data-architecture.md`.
- [x] Seed data and synthetic family fixtures added. `packages/fixtures`, P0-006.
- [x] CI green on clean checkout. `.github/workflows/ci.yml`, P0-001.
- [ ] PR required checks enabled. Same blocker as branch protection above.
- [x] AI agent registry created. `docs/ai-team/agent-registry.yaml`.
- [x] Worktree allocation convention documented. `tools/task-registry` `worktree` subcommand + `docs/implementations/phase-0-agent-worktrees.md`, P0-004.
- [x] Task registry/dashboard chosen or built. `tools/task-registry` CLI, P0-003; `tasks/registry.yaml` as the machine-readable source of truth.
- [x] Architecture/QA/Security gates automated at least at baseline. CI runs lint/typecheck/test/build/gitleaks/audit on every PR.
- [x] OpenAPI generation path established. `services/api/openapi/openapi.yaml` + `packages/api-client`, P0-005.
- [x] Observability baseline established. `packages/observability`, P0-007.
- [x] Backup/restore procedure tested in non-production. `pnpm db:backup`/`db:restore`, real drop-and-restore cycle verified against the live stack — see `docs/engineering/backup-dr.md`.
- [ ] macOS build node plan created for iOS.
- [ ] Android internal build path created.
- [ ] Telegram/MAX/Alice integration sandboxes separated from production.
