# Mobile Build Path

**Status:** Foundation
**Owner:** Mobile Lead
**Depends on:** MASTER_SPEC, `apps/mobile`
**Related:** `docs/engineering/ci-cd.md` ("Mobile"), `docs/engineering/environments.md`

Phase-0-checklist items: "macOS build node plan created for iOS" and
"Android internal build path created."

## Build node decision (iOS)

**GitHub-hosted `macos-latest` Actions runners.** No dedicated or cloud
Mac purchase is needed for CI-only, unsigned verification builds —
GitHub provides macOS runners as part of Actions. This is the right
default until release-signing needs justify something more (self-hosted
Mac mini, MacStadium, Xcode Cloud) — revisit only if GitHub-hosted
runner minutes/queue time become a real bottleneck, not preemptively.

## Workflows

`.github/workflows/mobile-android.yml` (`ubuntu-latest`) and
`.github/workflows/mobile-ios.yml` (`macos-latest`), both
`workflow_dispatch`-only for now (`apps/mobile` has no product code yet
— see `docs/engineering/repo-status.md`; switch to path-filtered
push/PR triggers once real mobile work starts). Both produce **unsigned,
internal-verification-only** artifacts:

- Android: `flutter build apk --debug`, uploaded as a CI artifact.
- iOS: `flutter build ios --debug --no-codesign`, uploaded as a CI
  artifact (not installable on a device without signing — this proves
  the build compiles, not that it's distributable).

## Android: what was actually verified locally, and where it stopped

`android/` is now a real, committed platform folder — installed Flutter
3.47.0, a JDK and the Android SDK (platform-tools, `android-34`,
`android-36`, matching build-tools) on this dev machine for real, ran
`flutter create --platforms=android .` for real (it only added
`android/`/`.metadata`/`analysis_options.yaml`/`test/`/`pubspec.lock` —
confirmed `lib/main.dart` and `pubspec.yaml` were untouched), and
`flutter doctor` confirms a fully working Android toolchain.

The actual `flutter build apk --debug` compile step could not be
completed on this machine: it fails with
`java.io.IOException: Unable to establish loopback connection`. Traced
this past Gradle entirely to a bare `java.nio.channels.Selector.open()`
call failing the same way — the JVM's internal loopback pipe now uses a
Unix-domain-socket connect on Windows, and `connect()` returns `EINVAL`
in this specific sandboxed session. Reproduced identically on both JDK
21 and JDK 17, so it isn't a JDK-version choice; this reads as a
sandbox-level restriction on `AF_UNIX` sockets, not a project
misconfiguration — and not something to work around by changing system
network settings, which is out of scope for a coding agent to touch.
**This is a local-environment limitation, not a workflow-correctness
one**: `.github/workflows/mobile-android.yml` runs on GitHub's own
`ubuntu-latest` runners, which don't share this sandbox's restriction —
the workflow itself was not blocked by this, only this one manual local
verification attempt was.

## iOS: not locally verifiable at all

`ios/` was not generated — Xcode is macOS-only and this dev machine runs
Windows, so there is no local path to generate or build the iOS platform
folder here regardless of the above. `mobile-ios.yml`'s YAML structure
was validated but the workflow itself has not been run end to end
against real GitHub `macos-latest` infrastructure yet.

## Signing (not resolved here)

Both Android (Play Console + upload key) and iOS (Apple Developer
Program + certificates/provisioning) signing require accounts only a
human can create. Once they exist: Android moves to a release job using
a keystore from Doppler (`docs/security/secrets-policy.md`); iOS adds a
fastlane/match or Xcode Cloud job for TestFlight. Track as a new task
once those accounts are provisioned — not part of Phase 0.
