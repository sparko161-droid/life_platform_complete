# Telegram Integration

**Status:** Planned
**Owner:** Integrations Lead

## Surfaces

- Bot
- Mini App

Telegram Mini Apps are web applications that can launch inside Telegram and support authorization and other platform capabilities.

## Architecture

Telegram Bot/Web App → Telegram Adapter → Life API.

## Rules

Telegram user identity is mapped to an internal external-account record; it is not the primary Life identity.

No business logic is duplicated in Telegram handlers.

## Candidate features

- task status
- parent quick actions
- notifications/links
- lightweight parent dashboard
- controlled child experience where product policy allows

## Source

https://core.telegram.org/bots/webapps
