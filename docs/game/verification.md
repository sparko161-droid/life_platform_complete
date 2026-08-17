# Verification Engine

**Status:** Foundation
**Owner:** Verification Architect

## Contract

```text
VerificationStrategy.verify(input) -> VerificationResult
```

## Result fields

status
source
confidence
value
metadata
verified_at
review_required

## Manual

MANUAL_SELF records self-completion.
PARENT_APPROVAL records parent decision.

## Media

PHOTO_PROOF / VIDEO_PROOF store media metadata and reference object storage.

## Camera

CAMERA_EXERCISE calls PoseProvider + ExerciseEngine. The engine returns count/quality/confidence.

## Fallback

If automatic verification confidence is insufficient, route to parent approval instead of silently granting reward.

## Security

Verification endpoints are idempotent and authorization scoped to family/child.
