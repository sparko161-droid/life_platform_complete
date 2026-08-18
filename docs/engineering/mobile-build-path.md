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

**A debug APK has now been built locally and verified** —
`app-debug.apk`, 143 MB, containing `classes.dex`, `AndroidManifest.xml`
and `libflutter.so` for `arm64-v8a`/`armeabi-v7a`/`x86_64`. Getting there
took two fixes, both of which are *path* problems on Windows, and both
worth recording because the first one was initially misdiagnosed.

### Fix 1 — `Unable to establish loopback connection`

Gradle failed instantly with
`java.io.IOException: Unable to establish loopback connection`, traced
past Gradle to a bare `java.nio.channels.Selector.open()` failing the
same way: the JVM's internal loopback pipe uses a Unix-domain-socket
connect on Windows, and `connect()` returned `EINVAL`.

This was **first written up here as an unfixable sandbox restriction on
`AF_UNIX` sockets. That conclusion was wrong.** The evidence that looked
conclusive — identical failure on JDK 21 and JDK 17, and with the
selector provider forced to `WindowsSelectorProvider` — only ruled out
the JDK version and the selector implementation. It never tested the
socket *path*. Re-running the same bare-Java repro with the sandbox
disabled failed identically, which ruled out the sandbox too and pointed
at the environment itself.

The actual cause: the JVM creates that socket under the temp directory,
which on this machine resolves to the 8.3 short name
`C:\Users\KUVSHI~1\AppData\Local\Temp\`. An `AF_UNIX` `connect()` on
such a path fails with `EINVAL`. Pointing the JVM at a clean short ASCII
directory fixes it outright:

```
JAVA_TOOL_OPTIONS=-Djdk.net.unixdomain.tmpdir=C:\jtmp
```

Deliberately **not** committed into `android/gradle.properties`: the
value is a machine-local absolute path, and a developer whose `TEMP` is
a normal long path never hits this. It belongs in the local environment
of whoever hits the error, which is what this section is for.

### Fix 2 — non-ASCII project path

With Fix 1 in place the build ran for 7 minutes and then failed on the
Android Gradle Plugin's own check:

> Your project path contains non-ASCII characters. This will most likely
> cause the build to fail on Windows.

The repo lives under `…\Desktop\Работа\…`. AGP refuses outright rather
than failing later in a confusing way. Verified the fix the
non-destructive way — a `git worktree` at `C:\lp-ascii` (same commit,
pure-ASCII path) — and the APK built there on the first attempt. AGP
offers `android.overridePathCheck=true` to silence the check; that was
not used, because AGP's own message says the build will most likely fail
anyway, and a green build from an ASCII path is stronger evidence than a
suppressed warning.

**Consequence for anyone building Android on this machine:** build from
an ASCII path. Either move the repo out from under `Работа`, or keep a
dedicated worktree (`git worktree add C:\lp-ascii <branch>`) for mobile
builds. CI is unaffected — GitHub's runners check out to
`/home/runner/work/...`, which is ASCII, and set a normal `TMPDIR`, so
neither fix is needed there.

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
