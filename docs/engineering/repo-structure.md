# Repository Structure

**Status:** Foundation
**Owner:** AI CTO

```text
apps/
  child-web/
  parent-web/
  admin-web/
  mobile/
  telegram-miniapp/
  max-miniapp/
  alice-skill/
services/
  api/
  worker/
  realtime/
  notifications/
  moderation/
  ai/
packages/
  ui/
  domain-types/
  api-client/
  task-engine/
  game-engine/
  verification/
  exercise-engine/
infrastructure/
  compose/
  terraform/
tools/
  task-registry/
docs/
.ai/
.github/
```

## Rules

- One app per independently deployable client surface.
- Shared packages contain reusable technical/domain primitives, not random helpers.
- Service extraction requires ADR.
- Tests live close to code unless they are cross-system fixtures.
- Generated files are reproducible and not hand-edited.
- `tools/` holds internal dev/CI tooling for the AI team (e.g. the task registry CLI) — not product code, not shipped to users, not a `package` in the domain sense.
