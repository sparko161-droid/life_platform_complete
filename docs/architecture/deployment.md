# Deployment Architecture

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## Environments
Local → Dev → Staging → Production.

## Local
Docker Compose: PostgreSQL, Redis, MinIO. Application processes may run on host for fast iteration.

## Dev
Shared isolated environment for integration and AI-agent QA.

## Staging
Production-like config, synthetic/test accounts and representative data shape; no real child media.

## Production
Separate credentials, private networks, monitored databases, backups, WAF/rate limits as justified, and controlled deploys.

## iOS
Flutter build requires macOS/Xcode. Use a dedicated Mac or macOS CI runner; deliver test builds through TestFlight.

## Android
CI builds APK/AAB; internal testing channel before store release.

## Rollback
Application deploys must support rollback. Database changes use backward-compatible steps when possible.
