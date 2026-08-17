# Child experience model

**Owner:** Child Experience Lead + Backend Lead

The child client consumes a coherent server-produced view of the current experience. It is a read model, not a source of truth.

## Core contents
- current day and time context
- active tasks and progress
- verification states
- current level, experience and series
- available rewards
- active quests/challenges
- permitted friends and games
- unread notifications
- safe personalization and avatar state

## Rules
- Snapshot is scoped to one child and family policy.
- Every item carries enough state/version information for safe rendering.
- Sensitive parent-only data is excluded by construction.
- Clients may cache the snapshot for offline display.
- Mutations still go through canonical commands.
- Snapshot refresh happens after relevant events or explicit reload.

## Acceptance
Child PWA, Android and iOS can render the same authoritative day from the same contract while applying device-specific capabilities only to presentation and interaction.