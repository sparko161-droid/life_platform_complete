# Frontend ↔ Backend Contract

**Owner:** Frontend Lead + Backend Lead
**Review:** Chief Architect, QA

Every interactive screen element maps to one canonical query/command or a local-only action.

## Contract tuple
`Screen → UI action → API/command → pending → response/event → state update → navigation/notification`.

## Rules
- Client never calculates authoritative XP, money, permissions or completion.
- Optimistic UI is allowed only for reversible presentation state.
- Mutations use idempotency keys where duplicate requests could create rewards, messages or completions.
- API errors expose machine code + safe user message + retryability.
- Permission failures are explicit; hidden UI is not authorization.
- Realtime events reconcile with authoritative GET/query responses.

## Example
Complete task → `POST task-completions` → `PENDING_VERIFICATION` → verification event → reward event → refresh task/progress/history.

## Acceptance
Every primary button in a production screen can be traced to a contract and a deterministic outcome.