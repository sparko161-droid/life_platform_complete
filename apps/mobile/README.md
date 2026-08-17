# Mobile — Flutter

Android and iOS share a Flutter/Dart codebase. Native platform integrations live behind interfaces.

## Local bootstrap
After Flutter SDK is installed:
```bash
flutter create --platforms=android,ios .
flutter pub get
flutter test
```

Do not hand-create signing credentials in this repository.
