# Offline and synchronization

**Owner:** Mobile Lead + Frontend Lead + Backend Lead

Offline support is a controlled client capability, not a second authority.

## Allowed offline
Cached task viewing, local timers, camera processing where supported, drafting evidence, queued non-sensitive messages and local navigation.

## Not final offline
Money, permissions, friendship, moderation, reward redemption and final task approval require server confirmation.

## Sync model
Local action → operation identity → sync queue → server authentication/policy/state check → authoritative result → local reconciliation.

## Conflict
If the server state changed while offline, do not silently overwrite it. Apply the concurrency policy and show a clear Russian-language recovery path.

## Privacy
Unsent child media remains encrypted/local according to retention policy and is deleted when the parent/user cancels or retention expires.

## Acceptance
A device can lose connectivity during a task and later reconcile exactly once without duplicate reward, broken streak or incorrect history.