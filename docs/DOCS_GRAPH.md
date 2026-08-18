# Documentation Graph

`MASTER_SPEC.md` is the index. Detail stays in short authoritative files.

## Governance
- `governance/project-evolution.md`

## Product
- `product/vision.md`
- `product/principles.md`
- `product/actors-and-permissions.md`
- `product/roadmap.md`
- `product/family-lifecycle.md`
- `product/daily-load.md`
- `product/learning-profile.md`
- `product/avatar.md`
- `product/competition.md`

## Family / task / learning
- `game/task-engine.md`
- `game/task-builder-rules.md`
- `game/task-builder-dsl.md`
- `game/verification.md`
- `game/exercise-engine.md`
- `game/economy.md`
- `game/progression.md`
- `game/scenarios.md`
- `game/competition-fairness.md`
- `game/games.md`
- `game/rewards.md`
- `game/rules-engine.md`
- `learning/development-profile.md`
- `learning/learning-sessions.md`

## Mechanics
- `mechanics/child-daily-loop.md`
- `mechanics/completion-reward-chain.md`

## UX / frontend contracts
- `ux/ui-architecture.md`
- `ux/ui-language.md`
- `ux/screen-contract-template.md`
- `ux/screen-map.md`
- `ux/child-flows.md`
- `ux/parent-flows.md`
- `ux/frontend-backend-contract.md`
- `ux/design-system.md`
- `ux/state-contracts.md`
- `ux/screen-api-matrix.md`
- `ux/journey-catalog.md`
- `ux/core-path-contracts.md`
- `ux/navigation-rules.md`
- `ux/action-api-catalog.md`
- `ux/error-recovery.md`
- `ux/ux-quality-gates.md`
- `ux/screens/*.md`

## Vertical slice
- `architecture/vertical-slice/task-to-reward.md`
- `architecture/vertical-slice/api-and-events.md`
- `architecture/vertical-slice/state-trace.md`
- `architecture/vertical-slice/test-matrix.md`
- `architecture/vertical-slice/ownership-map.md`

## Planning
- `planning/roadmap-overview.md`
- `planning/dependency-graph.md`
- `planning/workstreams.md`
- `planning/phase-handoff.md`
- `planning/implementation-map.md`
- `planning/responsibility-matrix.md`
- `planning/mechanics-contract-map.md`
- `planning/mechanics-gaps.md`
- `planning/gap-backlog.md`
- `planning/change-log.md`
- `planning/phases/*.md`

## AI team
- `ai-team/organization.md`
- `ai-team/roles.md`
- `ai-team/agent-registry.yaml`
- `ai-team/instructions/README.md`
- `ai-team/instructions/role-charters.md`
- `ai-team/workflow.md`
- `ai-team/task-lifecycle.md`
- `ai-team/discovery-rework.md`
- `ai-team/review-outcomes.md`
- `ai-team/gates.md`
- `ai-team/escalation.md`
- `ai-team/context-management.md`
- `ai-team/cto-dashboard.md`
- `ai-team/decision-record-template.md`
- `ai-team/task-template.md`

## Architecture / platform
- `architecture/system-context.md`
- `architecture/domain-map.md`
- `architecture/data-architecture.md`
- `architecture/api-contracts.md`
- `architecture/contract-registry.md`
- `architecture/events.md`
- `architecture/realtime.md`
- `architecture/deployment.md`
- `architecture/security-boundaries.md`
- `architecture/device-capabilities.md`
- `architecture/entity-lifecycle.md`
- `architecture/source-of-truth.md`
- `architecture/cross-domain-contracts.md`
- `architecture/time-and-calendar.md`
- `architecture/commands-and-idempotency.md`
- `architecture/concurrency-and-conflicts.md`
- `architecture/child-experience-model.md`
- `architecture/offline-and-sync.md`
- `platform/device-capabilities.md`

## Social / safety
- `social/graph.md`
- `social/parent-social.md`
- `social/parent-social-loop.md`
- `social/messaging.md`
- `social/chat-lifecycle.md`
- `social/competition.md`
- `social/notifications.md`
- `social/safe-sharing.md`
- `security/child-safety.md`
- `security/permissions.md`
- `security/effective-policy.md`
- `security/data-classification.md`
- `security/privacy.md`
- `security/threat-model.md`
- `security/legal-ru.md`
- `security/secrets-policy.md`

## AI / integrations
- `ai/architecture.md`
- `ai/knowledge-base.md`
- `ai/ai-safety.md`
- `ai/evaluation.md`
- `ai/avatar.md`
- `integrations/alice.md`
- `integrations/telegram.md`
- `integrations/max.md`
- `integrations/mcp.md`
- `integrations/sandbox-separation.md`

## Engineering
Developer-workspace and CI/CD process docs (`planning/phases/phase-0.md`'s output). Cross-referenced against `tasks/registry.yaml` by `scripts/check-docs-graph.mjs` (P0-012).
- `engineering/repo-structure.md`
- `engineering/repo-status.md`
- `engineering/stack.md`
- `engineering/dev-workspace.md`
- `engineering/local-environment.md`
- `engineering/git-workflow.md`
- `engineering/ci-cd.md`
- `engineering/branch-protection.md`
- `engineering/merge-gate.md`
- `engineering/coding-standards.md`
- `engineering/testing.md`
- `engineering/observability.md`
- `engineering/performance.md`
- `engineering/cost-controls.md`
- `engineering/release-management.md`
- `engineering/backup-dr.md`
- `engineering/environments.md`
- `engineering/mobile-build-path.md`
- `engineering/phase-0-checklist.md`

## Implementations
Concrete "how this was actually built" records for `tasks/registry.yaml` entries, one level more detailed than the phase docs.
- `implementations/README.md`
- `implementations/phase-0-task-registry.md`
- `implementations/phase-0-agent-worktrees.md`
- `implementations/phase-0-ai-orchestration.md`
- `implementations/phase-0-docs-traceability.md`

## Cases
`cases/` contains user journeys linked to domains and acceptance tests.

## Audit
`audit/coverage.md` records discussion coverage. `planning/mechanics-gaps.md` tracks cross-domain gaps.

## ADR
Foundational decisions live under `adr/`.
