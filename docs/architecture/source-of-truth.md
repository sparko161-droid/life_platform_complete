# Source of truth

**Owner:** Chief Architect

Each business fact has one authoritative owner. Other modules read it through contracts, queries or events.

| Fact | Authority |
|---|---|
| Family membership | Family domain |
| Permissions | Policy/Permission domain |
| Task definition | Task domain |
| Task assignment/completion | Task + Verification |
| Exercise result | Exercise Verification |
| XP / levels / skills | Progression |
| Coins | Economy |
| Money balance | Append-only Ledger |
| Reward availability | Reward domain |
| Friendship | Social |
| Messages | Messenger |
| Game result | Game Session |
| Learning evidence | Learning domain |
| AI recommendation | Recommendation/AI domain |
| Device link | Integration/Device domain |

## Client rule
Clients may cache and display state but never become authoritative for money, permissions, completion, rewards, friendship or moderation.

## Event rule
Events announce facts; they do not create a second source of truth.

## Review rule
If two modules both claim authority for the same fact, stop implementation and raise an architecture decision.