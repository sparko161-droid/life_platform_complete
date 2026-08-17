# Documentation Graph

**Rule:** Master Specification is the index and foundation. Domain documents stay short, authoritative and linked. Target <200 lines per document; split before the limit.

```text
MASTER_SPEC
├── product/
│   ├── vision.md
│   ├── principles.md
│   ├── actors-and-permissions.md
│   └── roadmap.md
├── architecture/
│   ├── system-context.md
│   ├── domain-map.md
│   ├── data-architecture.md
│   ├── api-contracts.md
│   ├── events.md
│   ├── realtime.md
│   ├── deployment.md
│   └── security-boundaries.md
├── engineering/
│   ├── stack.md
│   ├── repo-structure.md
│   ├── coding-standards.md
│   ├── testing.md
│   ├── ci-cd.md
│   ├── observability.md
│   ├── performance.md
│   ├── release-management.md
│   ├── dev-workspace.md
│   ├── git-workflow.md
│   ├── local-environment.md
│   ├── backup-dr.md
│   └── cost-controls.md
├── ai-team/
│   ├── organization.md
│   ├── roles.md
│   ├── workflow.md
│   ├── gates.md
│   ├── escalation.md
│   ├── context-management.md
│   ├── cto-dashboard.md
│   └── task-template.md
├── game/
│   ├── task-engine.md
│   ├── verification.md
│   ├── exercise-engine.md
│   ├── economy.md
│   └── games.md
├── social/
│   ├── graph.md
│   ├── messaging.md
│   └── notifications.md
├── security/
│   ├── privacy.md
│   ├── permissions.md
│   ├── child-safety.md
│   ├── threat-model.md
│   └── legal-ru.md
├── ai/
│   ├── architecture.md
│   ├── knowledge-base.md
│   ├── ai-safety.md
│   └── evaluation.md
├── integrations/
│   ├── telegram.md
│   ├── max.md
│   ├── alice.md
│   └── mcp.md
└── adr/
    ├── 0001-modular-monolith.md
    ├── 0002-cross-platform-mobile.md
    ├── 0003-on-device-pose.md
    └── 0004-short-docs-graph.md
```

## Graph rules
1. Every domain has one index/owner document.
2. Normative statements have one source of truth.
3. ADR explains why; domain docs explain what/how.
4. Tests link to domain behavior but are not a replacement for contracts.
5. If a node grows, split it and update links.
6. Every AI task loads the minimum relevant graph slice before coding.
