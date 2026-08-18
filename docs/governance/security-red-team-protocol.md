# Security Red Team Protocol

## Purpose

Security Engineering verifies that intended controls exist. Security Red Team independently attempts to defeat those controls. Both are mandatory for critical waves and phase exit.

## Minimum Phase 1 attack surface

- family isolation and IDOR;
- parent/child privilege escalation;
- authorization bypass on family-scoped endpoints;
- replay and idempotency abuse;
- concurrent request/race exploitation;
- media object access outside the family/permission boundary;
- reward duplication/manipulation and ledger abuse;
- malformed input and validation bypass;
- information disclosure through errors/logs/API responses.

## Findings

Every finding must include severity, preconditions, reproduction, affected boundary, recommended remediation and retest status.

A critical finding blocks acceptance until fixed or explicitly accepted by the Human Architect with risk, mitigation, owner and revisit condition.

## Independence

The Red Team does not implement or silently patch its own findings. Remediation is owned by the implementation team and reviewed by Security Engineering plus the relevant technical gate owner.
