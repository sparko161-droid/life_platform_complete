# Mechanics Contract Map

**Purpose:** show cross-domain links that must stay stable during parallel work.

| Mechanic | Upstream | Core contract | Downstream |
|---|---|---|---|
| Child day | assignment, scenario | DayState | UI, notifications, analytics |
| Task completion | attempt, verification | CompletionResult | rules, rewards, progression |
| Reward | trusted completion | RewardDecision | ledger, coupon, notification |
| Camera exercise | pose, exercise rule | VerificationResult | task, game, XP |
| Parent friendship | consent, profile | Friendship | chat, case sharing, family activity |
| Child friendship | parent policy | ChildRelationship | chat, games, challenges |
| Chat | relationship, policy | Message | realtime, moderation, notifications |
| Learning | task/session evidence | LearningResult | DevelopmentProfile, AI recommendations |
| Case | approved child result | SuccessCase | catalog, family copy |
| Competition | friends/team | ChallengeResult | ranking, rewards, safety |
| Integration | account/device link | ExternalIdentity | notifications, commands, task status |

## Freeze points

Each link requires versioned IDs/events, ownership, permission checks and acceptance tests before dependent streams code against it.

## Rule

A downstream team may mock an upstream contract but may not invent a competing domain model.