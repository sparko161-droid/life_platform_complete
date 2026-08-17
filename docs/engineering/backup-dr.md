# Backup and Disaster Recovery

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## Backup targets
PostgreSQL, object metadata, critical configuration and release artifacts.

## RPO/RTO
Initial targets are proposed in the operational planning backlog and must be finalized before production. Product-critical family/task data requires stronger recovery than transient cache.

## Recovery tests
A backup is not considered valid until restore has been tested periodically.

## Object storage
Enable versioning/lifecycle where available; protect against accidental deletion.

## Incident procedure
Detect → contain → restore service → verify integrity → communicate → postmortem → prevention task.
