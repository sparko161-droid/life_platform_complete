# Reward Engine

**Owner:** Game Design Lead
**Review:** Backend + QA

Reward is a typed entitlement, separate from task completion and economy.

Types: `XP`, `COINS`, `MONEY`, `SCREEN_TIME`, `DEVICE_TIME`, `COUPON`, `ACTIVITY`, `FAMILY`, `CUSTOM`.

## Rules
- Basic habits need not have money rewards.
- Money changes only through the family ledger.
- Coupon redemption is auditable and optionally one-use.
- Parent budget and per-day/per-period limits apply before activation.
- Reward reversals are compensating events, never destructive edits.

## Acceptance
Parent can define a reward, set eligibility and budget, child earns eligibility, parent confirms/redeems, and history remains auditable.