# Messenger

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## Message types
TEXT, VOICE, VIDEO_CIRCLE, IMAGE, SYSTEM, GAME_INVITE, ACHIEVEMENT, QUEST.

## Parent chat
Parents have direct chat and optional family/group chats.

## Child chat
Restricted to approved friendships and groups. Parent visibility is controlled by policy.

## Parent visibility modes
FULL, METADATA_ONLY, DISABLED. Policy is evaluated by backend on every protected read.

## Safety
Text, audio transcription and video/audio metadata may enter moderation pipelines. Children have a simple reporting path.

## Gamification
Communication XP must reward meaningful interaction, not message spam.
