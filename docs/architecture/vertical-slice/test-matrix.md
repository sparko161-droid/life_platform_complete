# Vertical slice — тестовая матрица

## Happy path
1. Seed family with one child and task.
2. Child opens «Мой день».
3. Child starts task.
4. Child submits valid proof.
5. Server verifies and records completion once.
6. Reward becomes available exactly once.
7. Child sees result and updated progress.
8. Parent sees relevant history/update.

## Negative paths
- Child without access opens task.
- Task is expired before submission.
- Proof is invalid or missing required evidence.
- Parent approval is required but absent.
- Parent rejects proof.
- Reward is no longer available.
- Same command is submitted twice.
- Network drops after submission.
- Parent and child act concurrently.

## Required assertions
- No duplicate completion.
- No duplicate reward ledger entry.
- No unauthorized task transition.
- No client-side authoritative balance mutation.
- Russian user-facing messages only.
- Audit/event trace exists for terminal result.
- Refresh/reconnect returns a consistent state.

## Test layers
Unit covers state predicates and idempotency. Integration covers transaction/event boundaries. API tests cover permissions and contracts. E2E covers the complete child/parent journey. Security review checks authorization and data scope.
