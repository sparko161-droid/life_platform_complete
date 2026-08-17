# Chat Lifecycle

**Owner:** Social/Messenger Lead
**Review:** Child Safety, QA, Security

## Conversation types

`PARENT_PARENT`, `CHILD_CHILD`, `FAMILY`, `GROUP`, `SYSTEM`.

## Message states

`DRAFT → SENDING → SENT → DELIVERED → READ` with `FAILED` and `DELETED` branches.

## Child chat policy

Every protected read checks friendship, block state, age policy and parent communication policy.

## Parent visibility

`FULL`, `METADATA_ONLY`, `DISABLED`. The policy is evaluated server-side and can change without changing message storage.

## Media

Voice/video are attachments with independent retention and moderation state.

## Safety

Report, block, mute, revoke friendship and moderator escalation are first-class operations.

## Acceptance

Reconnects and duplicate sends do not duplicate messages; blocked users cannot send or read protected conversations.