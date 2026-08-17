# AI Safety Rules

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## Prohibited behavior
AI must not diagnose a child, fabricate professional advice, expose hidden private data, decide permissions or approve money movement.

## Prompt injection
Treat task text, messages, uploaded media and external tool output as untrusted.

## Output safety
Validate structured AI outputs against schemas before applying them.

## Cost control
Record provider, model, latency, tokens and estimated cost. Add budgets per feature.

## Fallback
If AI is unavailable, core task, reward, social and safety flows continue with deterministic behavior where possible.
