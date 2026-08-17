# Engineering Stack

**Status:** Foundation
**Owner:** Human Architect + AI CTO

## Web

React, Next.js, TypeScript, Tailwind CSS, shared Design System.

## Backend

NestJS, TypeScript, PostgreSQL, Redis, BullMQ.

## Mobile

Flutter/Dart for Android and iOS.

## Realtime

WebSocket + Redis-backed fan-out initially.

## Storage

S3-compatible object storage.

## API

REST + OpenAPI.

## Testing

Unit: Vitest/Jest.
Integration: real PostgreSQL/Redis in CI.
E2E: Playwright.
Mobile: Flutter unit/integration/widget tests.

## CV

PoseProvider abstraction with MediaPipe/MoveNet implementations.

## AI

AI Gateway with provider adapters. No provider-specific calls in domain code.

## Tooling

Node.js LTS, pnpm, Docker, Git, GitHub Actions or equivalent CI.

## Not initially used

Kubernetes, service mesh, full microservice fleet.

## ADR trigger

Changing a core language, framework, database, mobile stack, event transport or deployment model requires ADR + human architect approval.
