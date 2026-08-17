# Security Boundaries

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## Trust zones
Client zone, API zone, worker zone, data zone, integration zone, admin zone.

## Boundary rules
All cross-zone calls use authenticated service identities. Workers receive only required scopes. Admin interfaces are isolated from child-facing apps.

## Secrets
Never commit secrets. Local secrets use `.env`; staging/production use a secret manager.

## Network
Default deny between components where practical. Databases are not public internet services.

## Encryption
TLS in transit. Provider-managed encryption at rest where available. Additional field-level encryption for sensitive values as required by risk assessment.
