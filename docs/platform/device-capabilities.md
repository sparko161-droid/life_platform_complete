# Device capability matrix

**Owner:** Mobile Lead + Integration Lead

Clients declare capabilities; features must define a fallback.

## Core capabilities
`CAMERA`, `MIC`, `PUSH`, `OFFLINE`, `SECURE_STORAGE`, `MEDIA_UPLOAD`, `REALTIME`, `DEEPLINK`, `BACKGROUND_EXECUTION`.

## Policy
- Web/PWA is feature-capable but must degrade safely.
- Native Android/iOS is preferred for camera CV and advanced offline/device features.
- Telegram/MAX Mini Apps reuse web logic but cannot assume all device APIs.
- Alice is voice/integration surface, not a source of business state.

## Rule
Every capability-dependent feature documents required capability, minimum version, fallback and failure UI before implementation.

## Acceptance
The same task can report unsupported capability clearly instead of failing silently.