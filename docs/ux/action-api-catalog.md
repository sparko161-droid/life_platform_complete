# UI action to server contract catalog

**Owner:** Frontend Lead + Backend Lead

The UI must call application operations through the typed client. Names below are engineering identifiers and never appear in user-facing text.

| UI action | Operation | Result | Next state |
|---|---|---|---|
| Create family | `family.create` | family created | family setup |
| Add child | `child.create` | child created | child profile |
| Invite parent | `family.parent.invite` | invitation created | invitation sent |
| Publish task | `task.publish` | assignment created | parent task list |
| Start task | `task.attempt.start` | attempt created | task active |
| Submit evidence | `task.evidence.submit` | evidence accepted | verifying / waiting approval |
| Approve | `task.approval.approve` | completion confirmed | reward processing |
| Return | `task.approval.return` | correction requested | child task state |
| Redeem reward | `reward.redeem` | redemption created | reward result |
| Add friend | `friend.request` | request created | pending |
| Send message | `conversation.message.send` | message accepted | conversation updated |
| Report | `moderation.report` | report created | confirmation |
| Join game | `game.session.join` | player admitted | game lobby |

## Contract rule
Each operation must define authorization, idempotency, validation, error category and emitted domain event. UI is responsible for presentation and recovery, not authoritative state mutation.

## Acceptance
Every important clickable action can be traced from screen contract to one canonical operation or a documented local-only action.
