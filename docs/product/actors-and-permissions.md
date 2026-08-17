# Actors and Permissions

**Status:** Foundation
**Owner:** Security + Product

## Actors

- CHILD
- PARENT_OWNER
- PARENT_ADMIN
- PARENT
- PARENT_OBSERVER
- PLATFORM_ADMIN
- MODERATOR
- SUPPORT
- AI_AGENT

## Core objects

Family is the main tenancy boundary.

Child data must always be scoped to a Family and permission checked server-side.

## Child social permissions

- friends
- text chat
- voice
- video circles
- group chat
- cooperative games
- competitive games

## Parent controls

Parent controls can disable a channel without deleting its data model.

## Chat visibility policy

`FULL` — parent may read child messages.
`METADATA_ONLY` — parent sees participants/time/activity but not content.
`DISABLED` — parent does not have content access.

The policy is evaluated at read time by backend authorization.

## Money permissions

Only parent/system services can mutate the child financial ledger.

## AI permissions

AI agents may read only the tools/data explicitly granted by the current task.
AI agents never receive production credentials by default.

## Admin permissions

Platform admins manage platform objects, not arbitrary family data without audited reason and access policy.
