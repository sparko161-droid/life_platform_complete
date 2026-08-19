# P1 Frontend — Parent/Child Web App Pack

**Status:** ADOPTED — all three blocking decisions confirmed by the Human Architect (httpOnly-cookie session model; two separate apps; stand the stack up now).
**Owner:** frontend-lead (packet drafted by ai-cto)
**Depends on:** P1-009/P1-013 (frozen screen + action contracts), P1-026/P1-028 (real API), P1-012 (Russian-only lint)
**Covers:** P1-010, P1-016, P1-003, P1-004 — and thereby unblocks P1-011, P1-017, P1-018, P1-007, P1-023

## Why this needs a packet

All 9 remaining Phase 1 tasks are gated behind frontend work, and
`apps/parent-web`, `apps/child-web` and `packages/ui` are still Phase 0
placeholders — a `package.json` with `typescript` and nothing else. This
is a new stack surface, not an increment on existing code, so it follows
the same design-then-confirm path the backend took
(tasks/packets/BLK-P1-006-007-persistence-api-pack.md).

## What is already fixed (not re-decided here)

- **Stack**: React/Next.js + Tailwind (docs/MASTER_SPEC.md §"Технологии").
- **Screens are frozen**: `packages/ux-contracts` exports `SCREEN_IDS`
  (C-TODAY, C-TASK, C-CAMERA, P-DASH, P-TASK-BUILDER, P-APPROVALS,
  P-REWARDS, ...) with routes, entry/exit edges and per-screen states,
  plus `RETIRED_SCREEN_IDS` for old references (ADR-0005).
- **Actions are frozen**: the action catalog maps each UI action to a
  real `operationId`, and `deriveUiTaskState`/`deriveUiRewardState`
  already translate domain status → UI state (including the subtle
  REJECTED-vs-FAILED and APPROVED-vs-REWARD_PENDING cases).
- **API is real and running**: 16 operations, session-authenticated,
  CI-verified against Postgres. `packages/api-client` already generates
  types from `openapi.yaml` and CI fails if they drift.
- **Copy rules are enforced**: `@life/ui-language` lints Russian-only
  copy and forbidden terms (P1-012); `UI_STRINGS` is the canonical
  catalog.

## Decisions this packet proposes

1. **Next.js App Router, two separate apps.** `apps/parent-web` and
   `apps/child-web` stay separate deployables rather than one app with
   role routing — they have different audiences, different safety
   requirements (docs/security/effective-policy.md: "UI visibility is
   never an authorization mechanism", child surfaces have their own
   child-safety gate owner) and different performance budgets. Shared
   code goes in `packages/ui`.
2. **`packages/ui` becomes the real design system**: Tailwind preset +
   primitives (Button, Card, TaskCard, StateBanner, EmptyState), each
   consuming `@life/ux-contracts` state types so a screen cannot render
   a state the contract does not define.
3. **Session handling**: the API issues a Bearer JWT with
   `{actorId, role, familyId}`. The browser stores it in an
   **httpOnly cookie set by a Next route handler**, never in
   `localStorage` — a child device is a shared device, and XSS on a
   child surface must not yield a token. Requests go through a thin
   server-side proxy route so the token never reaches client JS.
   *This is the one genuinely new security decision in this packet.*
4. **No new state library.** Server Components + route handlers for
   reads; a small typed fetch wrapper over `packages/api-client` for
   mutations. Adding Redux/TanStack Query is deferred until something
   actually needs client cache invalidation.
5. **Every screen renders from its contract**: a screen component takes
   its `ScreenId`, and a test asserts each declared state in
   `SCREENS[id].states` has a rendering path — so "loading/empty/error/
   offline" cannot be quietly skipped, which is what
   docs/ux/error-recovery.md exists to prevent.

## Proposed task order (existing task ids, no new ones needed)

| id | title | primary | why this order |
|---|---|---|---|
| P1-010 | Parent/child core navigation and API wiring | frontend-lead | Stands up both Next apps, `packages/ui`, the session-cookie proxy and the typed client. Everything else needs it. |
| P1-016 | Vertical slice API/client wiring and recovery states | frontend-lead | The loading/empty/offline/conflict/retry states against the real API — the half P1-017/P1-018 gate on. |
| P1-004 | Child today/tasks UX | frontend-lead | C-TODAY → C-TASK → result. The child half of the journey. |
| P1-003 | Parent task builder UX | frontend-lead | P-TASK-BUILDER + P-APPROVALS. The parent half. |

P1-010 → P1-016 is sequential; P1-003 and P1-004 can then run in
parallel (different screens, different files, one shared design system
that P1-010 already froze).

## Decisions confirmed

1. **httpOnly-cookie + server-proxy session model** — approved. The
   token is never readable from client JS on any surface.
2. **Two separate apps** (`apps/parent-web`, `apps/child-web`) —
   approved, with `packages/ui` as the shared design system.
3. **Stand the stack up now** — approved; the frontend is in scope for
   this Phase 1 effort, not deferred.

## Known risks

- This is the largest new dependency surface in the repo so far (React,
  Next, Tailwind, a component testing library). `pnpm audit` and `knip`
  are both wired into CI and will start reporting on real dependencies
  for the first time.
- `docs/ux/screens/*.md` specify eight screens that are *named* but have
  no template-conformant contract yet (`SPECIFIED_SCREEN_IDS`). Those
  are explicitly out of scope — only `SCREEN_IDS` screens get built.
- No media upload endpoint exists (DISC-P1-027-1), so C-CAMERA and the
  PHOTO_PROOF path cannot be completed end to end regardless of frontend
  work.
