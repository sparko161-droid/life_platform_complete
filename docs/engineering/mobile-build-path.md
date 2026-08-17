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

## Known limitation — read before relying on these

`apps/mobile/` currently has no `android/`/`ios/` platform folders —
nobody has run `flutter create --platforms=android,ios .` locally and
committed the result yet (this repo's environment doesn't have Flutter
installed, so that couldn't be done as part of this task either). Both
workflows self-heal by running `flutter create --platforms=... .` if the
folder is missing, so they're exercisable today, but **this is a stopgap,
not verified by an actual run** — no Flutter/Android SDK/Xcode toolchain
was available to actually execute either workflow end to end while
writing them; only their YAML structure was validated. The self-heal
step should be replaced with a plain `flutter pub get` once someone with
a working Flutter install generates and commits the real platform
folders (and reviews whatever native config `flutter create` produces,
which regenerating on every CI run would silently discard any future
customization to).

## Signing (not resolved here)

Both Android (Play Console + upload key) and iOS (Apple Developer
Program + certificates/provisioning) signing require accounts only a
human can create. Once they exist: Android moves to a release job using
a keystore from Doppler (`docs/security/secrets-policy.md`); iOS adds a
fastlane/match or Xcode Cloud job for TestFlight. Track as a new task
once those accounts are provisioned — not part of Phase 0.
