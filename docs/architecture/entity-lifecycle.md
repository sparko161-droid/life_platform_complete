# Entity lifecycle

**Owner:** Chief Architect

## Rule
Every durable domain entity has explicit states, allowed transitions and terminal behavior. UI must render server state; clients may request transitions but never invent them.

## Common pattern
`DRAFT → ACTIVE → ARCHIVED → DELETED` is the default only where applicable.

## Task
`DRAFT → ACTIVE → ASSIGNED → IN_PROGRESS → SUBMITTED → VERIFYING → APPROVED/REJECTED → COMPLETED → ARCHIVED`.

## Reward
`LOCKED → AVAILABLE → REDEEMING → REDEEMED`; alternative terminal states are `EXPIRED` and `CANCELLED`.

## Friendship
`INVITED → PENDING → ACTIVE`; exceptional states are `DECLINED`, `BLOCKED`, `REMOVED`.

## Conversation
`CREATED → ACTIVE → RESTRICTED → BLOCKED → ARCHIVED`.

## Game session
`LOBBY → READY → ACTIVE → FINISHED`; abnormal exits use `CANCELLED` or `EXPIRED`.

## Rules
- Transitions are server-authoritative.
- Invalid transitions return a domain result, never silent success.
- Every state-changing transition emits one canonical event where required.
- Terminal states are immutable except by an explicit correction workflow.
- Deletion must respect retention, audit and child-safety policies.

## Acceptance
A reviewer can trace every state change to a command, validation rule, owner and resulting event.