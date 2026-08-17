# Domain Map

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## Core domains
Identity, Family, Task, Quest, Verification, Exercise, Economy, Reward, Game, Social, Messenger, Notification, Media, Learning, AI, Content, Marketplace, Safety, Analytics, Integration, Admin.

## Ownership rule
Each domain owns its invariants and persistence model. Other domains use application services or events.

## Dependency direction
Identity/Family → nearly all domains.
Task → Verification/Reward/Game Events.
Social → Messenger/Game/Notification.
AI → tools into domains, never direct database access.
Analytics consumes events and should not become a source of truth.

## Forbidden dependencies
- UI → database
- Integration → database
- Domain A → Domain B tables directly
- AI provider SDK → domain service

## Extraction rule
Start modular. Extract only when deployment cadence, load, isolation, security or team ownership proves a need.
