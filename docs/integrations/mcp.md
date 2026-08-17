# MCP Integration

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## Role
MCP is an AI tool/integration boundary, not a domain architecture.

## Tools
Examples: getTodayTasks, getProgress, draftTask, draftQuest, getRewardCatalog, startLearningSession.

## Safety
Tools are allowlisted, typed, scoped and rate-limited. Never expose raw SQL or unrestricted repository access.

## Approval
Mutating tools that affect child policy, money, friendships or public content require explicit authorization and may require human approval.

## Providers
MCP adapters can serve internal AI agents or future external agent ecosystems without changing core domain logic.
