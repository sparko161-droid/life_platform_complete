# Social — Chat

**Screen ID:** SOCIAL-CHAT
**Owner:** Social Lead + Frontend Lead
**Review:** Child Safety + QA

## Variants
Parent chat, child chat and permitted family/group chat use the same conversation model with different policies.

## Data
Conversation summary, visible messages, unread count, permissions, moderation state and available attachments.

## Actions
Send text, voice or circle video where permitted; report; block; leave conversation; open approved profile/game/case.

## Parent visibility
Child chat visibility is determined by backend policy: full view, metadata-only or disabled. UI cannot override it.

## Language help
Text assistance may gently suggest spelling correction. It must not shame the child or block normal conversation unless safety policy requires it.

## States
Loading, empty, active, sending, failed, moderated, blocked, permission changed, offline.

## Acceptance
Every send/read/report action maps to a protected backend command and produces a defined state/event. No technical moderation reason is shown to the child.
