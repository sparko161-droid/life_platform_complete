# Domain Map

**Status:** Foundation
**Owner:** Chief Architect Agent

## Core domains

Identity
Family
Task
Quest
Verification
Exercise
Economy
Reward
Game
Social
Messenger
Notification
AI
Learning
Content
Moderation
Analytics
Integration
Admin

## Domain ownership rule

One domain owns its invariants. Other domains request changes through application interfaces or domain events.

## Key relationships

Family owns membership.
Child belongs to Family.
TaskTemplate becomes TaskAssignment for a Child.
TaskCompletion references TaskAssignment.
Verification produces VerificationResult.
RewardEngine consumes completion events.
GameEngine consumes progress events.
Social uses Family/Child identities but does not own them.
Messenger owns conversations/messages, not user identity.

## Event examples

`task.completed`
`task.approved`
`reward.granted`
`achievement.unlocked`
`friendship.created`
`message.sent`
`game.session.started`
`exercise.completed`

## Anti-patterns

- direct cross-domain SQL writes;
- duplicated identity models;
- child balance stored as mutable number;
- AI provider calls from controllers;
- integration-specific business rules inside domain modules.
