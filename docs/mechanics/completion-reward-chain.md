# Completion → Verification → Reward

**Owner:** Task/Domain Architect
**Review:** Game, QA, Security

## Canonical chain

`Assignment → Attempt → Evidence → VerificationResult → Completion → Events → RewardEvaluation → Grant/Reject → Ledger/Unlock`.

## Rules

- Attempt and completion are different records.
- Verification is idempotent; retries cannot duplicate rewards.
- A rejected verification keeps evidence/history unless policy requires deletion.
- Rewards are granted only from a trusted completion event.
- Reward calculation is deterministic for the same rule/version.
- Corrections create compensating entries or reversal events.

## Parent approval

`SUBMITTED → PENDING_PARENT → APPROVED|REJECTED`.

## Camera verification

Camera result may auto-complete only when exercise policy and confidence thresholds pass; otherwise parent review is fallback.

## Acceptance

Repeated taps, retries, reconnects and duplicate events never grant the same reward twice.