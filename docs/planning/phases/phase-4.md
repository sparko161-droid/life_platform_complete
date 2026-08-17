# Phase 4 — Social, Messenger, Competition and Safety

## Objective
Build safe social life for children and parents, including family-level relationships.

## Streams
E1 Parent Social, E2 Child Social, E3 Messenger, E4 Voice/Circle Video, E5 Safety/Moderation, E6 Notifications, E7 Challenges/Competition.

## Mechanics
Parent invitations and friendships; child friendships only through approved paths; family friendship; parent interests; shared cases/statistics; child achievement sharing; text/voice/circle messages; spelling feedback for text; message XP with anti-spam limits; challenges and cooperative goals; block/revoke lifecycle; protected-read policy evaluation.

## Parent chat
Parent-to-parent chat is independent of child chat. Family/group chats require explicit membership. Parent relationships may be revoked without deleting historical child progress.

## Child chat visibility
Backend policy supports FULL, METADATA_ONLY and DISABLED parent visibility. Policy is checked on every protected read and can change without rewriting stored messages.

## Safety
Moderation, report, block, consent, abuse handling, message idempotency and rate limits are release blockers for child communication.

## Contract gate
Friendship state, conversation state, moderation result, visibility policy and notification events are frozen before client integrations.

## Exit
Approved parent friendship, child friendship, family relationship, safe chat, notifications, moderation and at least one cooperative/competitive challenge work end-to-end, including block/revoke and reconnect cases.
