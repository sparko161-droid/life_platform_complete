# Integration Sandbox Separation

**Status:** Foundation
**Owner:** Integrations Lead / Security & Child Safety
**Depends on:** MASTER_SPEC, `docs/security/secrets-policy.md`, `docs/engineering/environments.md`
**Related:** `docs/integrations/telegram.md`, `docs/integrations/max.md`, `docs/integrations/alice.md`

Phase-0-checklist item: "Telegram/MAX/Alice integration sandboxes
separated from production."

## Rule

Every integration has **two distinct external identities** — a sandbox
bot/skill and a production bot/skill — never one bot/skill reused across
environments by just swapping a token. Reusing one bot across `dev`/`stg`
would mean a `dev` bug can message real users, and a leaked `dev` token
would compromise the production surface too.

| Integration | Sandbox identity | Production identity |
|---|---|---|
| Telegram | Separate bot via @BotFather, test-only, never listed/discoverable | Separate bot, the one users actually find |
| MAX | Separate bot registration | Separate bot registration |
| Alice | Separate skill in the Yandex Dialogs sandbox/draft state (skills are normally unpublished/draft until submitted) | Published skill |

## What this repo defines vs. what's still a human step

This document fixes the **policy** (never share one bot/skill identity
across environments) and the **token storage shape** (below). Creating
the actual sandbox accounts — a Telegram bot via @BotFather, a MAX bot
registration, a draft Alice skill in the Yandex Dialogs console — needs
a human with a phone number/Yandex account to click through each
platform's own onboarding; no coding agent can do that. Tracked as a
setup step for whoever owns the first Telegram/MAX/Alice integration
task (`docs/integrations/telegram.md`, `max.md`, `alice.md`; not yet
scheduled in `tasks/registry.yaml`'s Phase 5 integration tasks).

## Token storage

Per `docs/security/secrets-policy.md`'s Doppler config structure:

- `dev`/`stg` configs hold the **sandbox** bot/skill tokens.
- `prd` config holds the **production** bot/skill tokens.
- Never fall back from one to the other in code — if a production
  token is missing, fail closed, don't silently try the sandbox token.

## Verification before go-live

Before a production bot/skill goes live, confirm: it has never been
used to send a message/response outside a controlled test, its
production token has never appeared in a `dev`/`stg` config or log, and
the sandbox identity remains reachable for continued testing after
launch (don't promote the same identity — keep both running in
parallel).
