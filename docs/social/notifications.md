# Notification Model

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## Channels
Web Push, Android/iOS Push, In-App, Alice adapter where officially supported, bot notifications.

## Event-driven
Domain event → notification policy → user preference → permission → channel adapter.

## Categories
Task reminders, approvals, achievements, friend requests, messages, games, family events, security alerts.

## Preferences
Parent controls child notification categories; child cannot suppress safety/security notifications required by policy.

## Quiet hours
Support local-time quiet windows and per-category overrides.
