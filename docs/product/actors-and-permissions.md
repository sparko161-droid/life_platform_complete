# Actors and Permissions

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## Actors
- Platform Admin
- Safety Moderator
- Support Agent
- Family Owner
- Parent
- Child
- AI Agent
- Integration App

## Core rules
Family is the security boundary for child data.
Parent permissions are scoped to the family and selected children.
AI agents are service principals, not users.
Integrations receive explicit scopes.

## Child access
Child can read own tasks/progress and approved social content. Child cannot alter monetary ledger or security policies.

## Parent access
Parent can manage permitted children, tasks, rewards, friendship consent and social policies according to family role.

## Admin access
Admin access is separated by capability; moderators do not automatically receive financial or infrastructure permissions.

## Authorization
Every sensitive API call resolves: actor → family scope → child scope → resource ownership → policy → action.
