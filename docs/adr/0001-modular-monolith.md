# ADR-0001 Modular Monolith First

**Status:** Accepted
**Owner:** Chief Architect
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## Decision
Start with a modular monolith plus workers and realtime gateway.

## Why
The product has many domains but uncertain early load and team size. Strong module boundaries deliver much of the benefit of service separation without distributed-system overhead.

## Consequence
Domain ownership and dependency rules must be enforced in code review and tests.

## Revisit when
A service boundary has a clear operational, security, scale or ownership benefit.
