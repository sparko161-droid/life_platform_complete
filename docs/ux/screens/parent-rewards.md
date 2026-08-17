# Parent — Rewards

**Screen ID:** P-REWARDS
**Owner:** Game Engine Lead + Frontend Lead
**Review:** QA + Security

## Purpose
Configure and review rewards without changing historical transactions.

## Data
Available rewards, eligibility, cost, limits, redemption history and money ledger where authorized.

## Actions
Create/edit future reward → reward policy command. Approve/reject redemption → ledger/reward command. Reverse a mistaken operation → compensating entry only.

## States
Available, locked, pending approval, redeemed, expired, unavailable, conflict, failed.

## Rules
Child sees only the public reward description and permitted balance. Parent sees financial details only for their family.

## Language
Russian only. Use «награда», «купон», «монеты», «деньги», «время планшета» rather than internal currency names.

## Acceptance
A reward can be configured, redeemed once, audited and safely reversed without destructive balance edits.
