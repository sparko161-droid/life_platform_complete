# Threat Model

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## Threats
Account takeover, broken object-level authorization, child impersonation, message abuse, media leakage, webhook spoofing, replay, prompt injection, AI data exfiltration, reward fraud, camera false positives.

## Controls
MFA for privileged accounts, token rotation, object-level authz, signed webhook validation, idempotency, rate limits, moderation, audit logs, on-device CV, constrained AI tools.

## AI threats
Never let an LLM decide authorization. Tool calls require explicit scopes and server-side validation. Treat user content as untrusted input.

## Review
Threat model is updated for every new social, AI, payments or integration capability.
