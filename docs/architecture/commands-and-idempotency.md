# Commands and idempotency

**Owner:** Backend Lead

Every state-changing client action is a command with a stable operation identity where duplicate delivery is possible.

## Required for
Task completion, parent approval, reward redemption, money ledger posting, friendship changes, invitations, message send, game join/finish and sync retries.

## Rule
Repeating the same logical command must not create a second business effect.

## Pattern
Client creates operation key → server authenticates and authorizes → domain validates current version/state → command is applied once → result is stored/replayed for retries.

## UI behavior
Double taps, refreshes and network retries show the same authoritative result instead of duplicate rewards or messages.

## Event consumers
All consumers must tolerate at-least-once event delivery.

## Failure
Unknown result after network loss must be resolved by querying operation status, not by blindly repeating the business action.

## Acceptance
Tests prove duplicate completion, approval and redemption requests produce one business effect and one ledger entry where applicable.