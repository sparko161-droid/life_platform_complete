# Deployment Architecture

**Status:** Foundation
**Owner:** DevOps / AI CTO

## Environments

LOCAL → DEV → STAGE → PROD.

## Local principle

Developers should start a stable platform stack once and iterate code quickly. Feature work must not require rebuilding database/cache/storage containers each time.

## Local services

PostgreSQL
Redis
S3-compatible storage
API
Worker
Realtime
Mail/test notification sink
Optional observability stack

## Deployment rule

Every environment is described as code/config. Manual production configuration is forbidden unless documented as an emergency procedure.

## CI pipeline

lint → typecheck → unit → integration → build → E2E → security → artifact → stage deploy.

Production deploy requires approval and successful stage verification.

## iOS

iOS builds use macOS/Xcode runners or a managed macOS build host. Windows remains a primary development machine if desired; TestFlight is the distribution channel for physical iOS testing.

Official Flutter iOS setup requires Xcode for running/building/deploying to iOS. See: https://docs.flutter.dev/platform-integration/ios/setup
