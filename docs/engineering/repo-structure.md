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
