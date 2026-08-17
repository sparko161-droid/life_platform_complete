# ADR-0004 Documentation Graph

**Status:** Accepted
**Owner:** Chief Architect
**Depends on:** MASTER_SPEC
**Related:** docs/DOCS_GRAPH.md


## Decision
Keep each documentation node under roughly 200 lines and link nodes through a graph.

## Why
AI agents lose context when documents become monoliths. Small authoritative nodes reduce context dilution and make ownership explicit.

## Consequence
Index files and cross-links are mandatory. Repeated normative rules are forbidden.
