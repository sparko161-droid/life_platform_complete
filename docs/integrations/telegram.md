# Telegram Integration

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## Surfaces
Bot + Mini App.

## Web client
Mini App is a web surface using Telegram WebApp APIs.

## Security
Validate `initData` on the server. Never trust `initDataUnsafe`. Validate freshness/auth_date and signature according to Telegram rules. citeturn232758search2

## Identity
Map verified Telegram user identity to a Life identity through explicit linking, not by trusting client-supplied child IDs.

## Scope
Status, reminders, task summaries and approved parent flows first. Do not expose child-sensitive data without Life policy checks.
