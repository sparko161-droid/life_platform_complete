# MCP Integration

**Status:** Planned
**Owner:** AI Architecture Lead

## Purpose

MCP is an adapter/tooling layer for controlled AI access to Life capabilities.

## Rule

MCP never bypasses application services and never gets unrestricted DB access.

## Candidate tools

- get_today_tasks
- get_child_progress
- get_reward_catalog
- create_task_draft
- generate_quest_draft
- get_learning_recommendations
- start_learning_session

## Permission

Each tool declares role, family scope, child scope, read/write mode and audit requirements.

## Approval

Any tool that can create or mutate high-impact child/family state must require an explicit policy/approval path.
