# UI State Contracts

**Owner:** Frontend Lead
**Review:** QA + Backend Lead

## Task states
`NOT_STARTED → IN_PROGRESS → SUBMITTED → VERIFYING → APPROVED | REJECTED | FAILED → REWARD_PENDING → COMPLETED`.

## Chat states
`CONNECTING → ACTIVE → SENDING → SENT → DELIVERED → READ`; failures support retry without duplicate send.

## Camera states
`PERMISSION → FRAMING → READY → ACTIVE → PAUSED → RESULT | LOW_CONFIDENCE | ABORTED`.

## Reward states
`LOCKED → AVAILABLE → REDEEMING → REDEEMED | FAILED | EXPIRED`.

## AI generation
`IDLE → GENERATING → DRAFT → NEEDS_REVIEW → APPROVED | EDITED | REJECTED`.

## Rule
Transitions come from domain responses/events. Client may animate between states but may not invent terminal business states.

## Acceptance
Each state has a visual treatment, allowed actions, retry behavior, accessibility message and telemetry identifier.