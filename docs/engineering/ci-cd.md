# CI/CD

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## PR pipeline
Install → lint → typecheck → unit → integration → build → security scan → E2E where configured.

## Merge gates
Protected main branch. Required status checks. At least one independent reviewer for substantive changes.

## Deploy pipeline
Merge to main → build artifact → deploy staging → smoke tests → human/AI release gate → production.

## Mobile
Android artifact and iOS TestFlight artifact are built from tagged/approved commits. Signing credentials are isolated from ordinary agents.

## Supply chain
Pin lockfiles. Scan dependencies. Generate SBOM when tooling is available.
