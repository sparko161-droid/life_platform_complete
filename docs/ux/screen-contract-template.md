# Screen contract template

**Purpose:** every important screen is specified as a product contract before implementation.

## Identity
- Screen ID
- Role
- Route
- Entry points
- Exit points

## Data
- Queries
- Commands
- Events
- Required permissions
- Source of truth

## States
- Loading
- Empty
- Ready
- Submitting
- Success
- Validation error
- Network error
- Permission denied
- Offline
- Session expired

## Actions
For every visible action define:
`button → command/query → backend result/event → UI state → next navigation`.

## Navigation
Every action has an explicit next destination or stays on the current screen with a defined state change.

## Copy
All visible text comes from localization and follows `docs/ux/ui-language.md`.

## Accessibility
Focus order, touch target, readable text, contrast, screen-reader label and reduced-motion behavior must be defined where relevant.

## Analytics
Only product events are recorded. Never send child private message content, raw media or sensitive data to analytics.

## Acceptance
A screen is ready for implementation only when its data, actions, permissions and all important states are defined.
