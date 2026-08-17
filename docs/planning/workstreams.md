# Parallel Workstreams

**Purpose:** show where independent teams can work concurrently and where contracts connect them.

## Workstream map

| ID | Stream | Lead | Phase | Main outputs |
|---|---|---|---|---|
| A0 | Git/CI | DevOps | 0 | branches, CI |
| A1 | Dev infra | DevOps | 0 | compose, env |
| A2 | AI ops | AI CTO | 0 | agents, gates |
| B1 | Identity/Family | Backend | 1 | auth, family |
| B2 | Task Engine | Backend | 1 | tasks, assignment |
| B3 | Child UX | Frontend | 1-2 | child flow |
| B4 | Parent UX | Frontend | 1-2 | builder/dashboard |
| B5 | Media | Backend | 1 | evidence |
| C1 | Economy | Game | 2 | XP, coins, ledger |
| C2 | Quests | Game | 2 | quest logic |
| D1 | Mobile | Mobile | 3 | Flutter |
| D2 | CV | CV | 3 | pose provider |
| D3 | Exercise | CV/Game | 3 | rules |
| E1 | Social | Social | 4 | graph |
| E2 | Messenger | Backend | 4 | realtime |
| E3 | Safety | Safety | 4 | moderation |
| F1 | AI | AI/ML | 5 | gateway |
| F2 | Learning | Learning | 5 | KB/sessions |
| F3 | Integrations | Integration | 5 | Alice/TG/MAX |
| G1 | Games | Game | 6 | game runtime |
| G2 | Marketplace | Content | 6 | templates/cases |

## Parallelism rule

A stream may begin when its input contracts are frozen, even if the source phase is still finishing unrelated work.

## Sync points

Architecture contract, API/schema, event definitions, permissions, UI contract, acceptance tests.

## Cross-stream owner

AI CTO coordinates. Chief Architect resolves contract conflicts. Human Architect resolves product decisions with durable consequences.
