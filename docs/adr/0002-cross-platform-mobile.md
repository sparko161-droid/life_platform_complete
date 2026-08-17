# ADR-0002 Flutter Mobile

**Status:** Accepted
**Owner:** Chief Architect
**Depends on:** MASTER_SPEC
**Related:** docs/engineering/stack.md


## Decision
Use Flutter for Android and iOS mobile apps.

## Why
Shared UI/business-client code, strong mobile support and native interop for camera/push/offline requirements.

## Constraint
iOS builds require macOS/Xcode. CI/TestFlight workflow is part of the architecture.

## Revisit when
A platform-specific capability cannot be delivered with acceptable performance or maintainability.
