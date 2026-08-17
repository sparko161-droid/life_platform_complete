# AI Context Management

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## Context loading
Agent loads the smallest relevant graph slice: Master Spec → domain map → domain docs → ADRs → task → code.

## Source priority
1. Human-approved ADR
2. Domain specification
3. API/event contracts
4. Tests
5. Implementation
6. Historical discussion

## Graph maintenance
Every new domain adds an index node. Every ADR declares affected domains. Avoid copying long rules into multiple files.

## Knowledge loss prevention
When a decision changes, update the owning short doc and create an ADR if foundational. Do not rely on chat history as the only source.
