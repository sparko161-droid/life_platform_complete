# Phase 3 — Mobile, Camera Verification and Device Layer

## Objective
Provide production-grade mobile foundations and the first automated physical verification flow.

## Core domains

Flutter mobile shell, device registry, push, offline sync, camera verification, pose overlay, Exercise Engine.

## Responsible

Mobile Lead: Flutter. CV Lead: pose provider. Exercise Lead: deterministic rules. Backend Lead: verification API. QA Lead: device matrix.

## Parallel streams

D1 Android/iOS shell, D2 Camera UX, D3 Pose provider, D4 Exercise engine, D5 Offline sync, D6 Push/device registry.

## Safety rule

Raw exercise video is not stored by default. Only derived verification results are sent to backend unless explicit evidence mode is enabled.

## Exit criteria

At least one exercise (squat) can be recognized on supported devices with on-screen skeleton, live counter, guidance and deterministic test fixtures.
