# Performance Baseline

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## Initial targets
API P95 < 300 ms for ordinary read/write operations under expected load.
Child dashboard usable within ~2 seconds on normal mobile networks after cached shell loads.
Realtime message acknowledgement target < 500 ms under normal conditions.
Camera overlay target 20–30 FPS on supported devices; degraded mode allowed.

## Load tests
Test task feed, chat fan-out, notifications, media upload initiation, reward ledger and game session concurrency.

## Rule
Never optimize blindly. Use traces and load tests to choose bottlenecks.
