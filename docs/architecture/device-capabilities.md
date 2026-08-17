# Platform and Device Capability Matrix

**Owner:** Mobile Lead
**Review:** Web, QA, DevOps, Security

## Surfaces

Child PWA, Parent Web, Admin Web, Flutter Android/iOS, Telegram Mini App, MAX Mini App, Alice skill.

## Capability classes

Camera, microphone, push, background execution, offline storage, secure storage, media upload, realtime and deep links are modeled as capabilities rather than assumed platform features.

## Policy
Each feature declares required capabilities, fallback behavior and minimum supported versions. A missing capability must degrade safely rather than silently changing verification semantics.

## Camera verification
Full pose overlay and high-frequency camera processing target native mobile first. Web may support compatible browsers. Messenger Mini Apps are not assumed to support the full CV experience.

## Offline
Task viewing and evidence capture may use a local queue. Server remains authoritative; sync is idempotent and conflict policy is explicit.

## Release
Android and iOS share Flutter domain/UI packages. iOS signing/build runs through macOS/Xcode infrastructure. Web and mini-app builds remain independent adapters.
