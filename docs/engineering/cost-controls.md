# Cost Controls

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## Main cost drivers
AI inference, media storage/egress, realtime connections, database compute, CI and mobile build infrastructure.

## Controls
Feature budgets, per-family quotas where appropriate, media lifecycle, image/video processing limits, provider routing and caching.

## AI
Use deterministic code for deterministic problems. Use small/cheap models for classification where acceptable; reserve strong reasoning models for architecture and complex generation.

## Reporting
AI CTO dashboard includes cost by feature, provider and environment.
