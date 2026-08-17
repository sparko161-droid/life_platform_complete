# Documentation Graph

Master Specification намеренно короткая. Каждый домен разбивается на небольшие документы.

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
│   └── deployment.md
├── engineering/
│   ├── stack.md
│   ├── repo-structure.md
│   ├── coding-standards.md
│   ├── testing.md
│   ├── ci-cd.md
│   └── observability.md
├── ai-team/
│   ├── organization.md
│   ├── roles.md
│   ├── workflow.md
│   ├── gates.md
│   ├── escalation.md
│   └── context-management.md
├── game/
│   ├── task-engine.md
│   ├── verification.md
│   ├── exercise-engine.md
│   ├── economy.md
│   └── games.md
├── security/
│   ├── privacy.md
│   ├── child-safety.md
│   ├── permissions.md
│   └── threat-model.md
└── integrations/
    ├── telegram.md
    ├── max.md
    ├── alice.md
    └── mcp.md
```

## Graph rules

1. Master Specification contains fundamentals and links.
2. Domain docs contain implementation-meaningful detail.
3. ADRs explain why a non-obvious decision exists.
4. No duplicated normative rules across documents.
5. When a document exceeds 200 lines, split it.
6. Each document declares `status`, `owner`, `depends_on`, `related`.
7. Code comments do not replace architecture docs.
8. Tests are linked from domain docs where behavior is important.
