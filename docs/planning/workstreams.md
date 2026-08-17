# Parallel Workstreams

| ID | Stream | Lead | Phase | Contract handoff |
|---|---|---|---|---|
| A0 | Git/CI | DevOps | 0 | repo/CI |
| A1 | Dev infra | DevOps | 0 | env/health |
| A2 | AI ops | AI CTO | 0 | task/agent APIs |
| A3 | Docs/ADR | Documentation | 0 | knowledge graph |
| A4 | Security baseline | Security | 0 | policy/permissions |
| B1 | Identity/Family | Backend | 1 | family/auth |
| B2 | Task/Rules | Backend | 1 | Task DSL/API/events |
| B3 | Child UX | Frontend | 1-2 | child states |
| B4 | Parent UX | Frontend | 1-2 | builder/dashboard |
| B5 | Media | Backend | 1 | evidence contract |
| B6 | Economy | Game | 1-2 | ledger/events |
| C1 | Progression/Quests | Game | 2 | game events |
| C2 | PWA shell | Frontend | 2 | design system |
| D1 | Mobile | Mobile | 3 | device/capability |
| D2 | CV | CV | 3 | pose provider |
| D3 | Exercise | CV/Game | 3 | verification |
| D4 | Offline/Push | Mobile | 3 | sync/device |
| E1 | Parent Social | Social | 4 | friendship policy |
| E2 | Child Social | Social | 4 | consent graph |
| E3 | Messenger | Backend | 4 | realtime/media |
| E4 | Safety | Safety | 4 | moderation/reporting |
| E5 | Notifications | Backend | 4 | delivery contract |
| F1 | AI Gateway | AI/ML | 5 | capability API |
| F2 | Learning/KB | Learning | 5 | evidence/profile |
| F3 | Avatar | AI/ML | 5 | safe asset API |
| F4 | Alice | Integration | 5 | account/device link |
| F5 | Telegram/MAX | Integration | 5 | adapter contracts |
| G1 | Games | Game | 6 | session protocol |
| G2 | Marketplace | Content | 6 | case/template |
| G3 | Community | Social/Content | 6 | moderation |

## Start rule
A stream may start when its consumed contract is frozen and its test fixtures exist.

## Sync points
Architecture contract, API/schema, events, permissions, UI states, acceptance tests, migration notes and known limitations.

## Parallelism
Task/Rules, Parent UX, Child UX and Media can overlap after contracts. Economy can use mocked GameEvents. Parent Social can begin from stable Family/Permission contracts while core task work continues.

## Cross-stream owner
AI CTO coordinates. Chief Architect resolves technical conflicts. Product Manager resolves scope. Human Architect resolves durable product, safety and money decisions.
