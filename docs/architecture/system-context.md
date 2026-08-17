# System Context

**Status:** Foundation
**Owner:** Chief Architect Agent

```text
Child Web/PWA ─┐
Parent Web ─────┤
Admin Web ──────┤
Android ────────┤
iOS ────────────┤
Telegram ───────┤
MAX ────────────┤
Alice ──────────┘
        ↓
      API / Application Layer
        ↓
   Domain Modules + Event Bus
        ↓
 PostgreSQL + Redis + Object Storage
        ↓
 Workers / Notifications / AI / Moderation
```

## Rules

1. Clients never call database directly.
2. Integrations never contain domain logic.
3. AI calls application services/tools, never SQL directly.
4. Media is stored outside PostgreSQL.
5. Realtime events use the same domain events as other clients.
6. Critical state changes are transactional and auditable.

## Architectural style

Start as modular monolith + workers. Extract services only after evidence: scale, isolation, deployment cadence, security boundary, or operational need.

## Boundaries

Domain modules own their data and application services.
Shared packages must not become a dumping ground for business logic.
