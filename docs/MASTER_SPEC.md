# Master Specification — «Жизнь»

**Version:** 0.3
**Status:** Foundation / Architecture Baseline
**Owner:** Human Architect / Product Owner

## 1. Mission
«Жизнь» — Russian-language family platform where a child turns real-life activities, learning, sport and responsibility into a game with progress, friends, family interaction and rewards.

## 2. Core principles
1. Real life is the primary game world.
2. Child is the player; parent owns family rules.
3. Money is optional, not the only motivator.
4. Recommendations are optional; parent policy is authoritative.
5. Child privacy and safety are first-class architecture constraints.
6. Parent and child social graphs are separate.
7. Clients contain presentation/state management, not authoritative domain rules.
8. AI proposes/assists; critical product, privacy and money decisions remain human-controlled.
9. ML/CV senses; deterministic engines decide exercise verification.
10. New domains need an architecture contract before implementation.
11. Documentation is a graph of short authoritative files, not a giant specification.
12. AI development follows gates and independent review.

## 3. Product domains
Identity, Family, Tasks, Quests, Verification, Exercise, Economy, Rewards, Games, Social, Messenger, Notifications, Media, Learning, AI, Knowledge Base, Content, Marketplace, Safety, Analytics, Integrations, Admin.

## 4. Client surfaces
Child Web/PWA, Parent Web, Admin Web, Flutter Android/iOS, Telegram Mini App/Bot, MAX Mini App/Bot, Alice skill.

## 5. Technical stack
TypeScript/Node.js, React/Next.js, Tailwind + shared design system, NestJS, PostgreSQL, Redis, BullMQ, WebSocket, S3-compatible storage, REST/OpenAPI, Flutter/Dart, Docker, CI/CD, OpenTelemetry/Sentry-class observability.

## 6. Architecture shape
Start with a modular monolith + workers + realtime. Extract services only by ADR after evidence.

## 7. Data rules
PostgreSQL is source of truth. Money uses an append-only ledger. Media is outside PostgreSQL. Child data is access-controlled by family/child policy.

## 8. Task Engine
Task = content + schedule + rules + verification + reward + gameplay + notifications.
Initial strategies: MANUAL_SELF, PARENT_APPROVAL, PHOTO_PROOF, VIDEO_PROOF, CAMERA_EXERCISE, TIMER, COUNTER, AUDIO_PROOF, ALICE_SESSION, COMPOSITE.

## 9. Verification
`Task → Verification → Result → Event/Reward`.
Camera: `Camera → PoseProvider → landmarks → overlay → deterministic ExerciseEngine → result`.
Raw exercise frames are not stored by default.

## 10. Social
Parent Friendship, Child Friendship, Family Friendship and Groups are separate graphs. No unrestricted child discovery.

## 11. Messenger
TEXT, VOICE, VIDEO_CIRCLE, IMAGE, SYSTEM, GAME_INVITE, ACHIEVEMENT, QUEST. Parent visibility can be FULL, METADATA_ONLY or DISABLED by policy.

## 12. Game/Economy
XP, Coins, Money Ledger, Coupons, Levels, Streaks, Skills, Achievements and Game Sessions are separate concepts.

## 13. AI
AI Gateway hides providers. AI tools are typed, scoped and policy-checked. MCP is an adapter. Knowledge Base is versioned and evidence-backed. AI cannot diagnose, authorize or move money.

## 14. Integrations
Telegram/MAX are web adapters; Alice is a skill adapter using official account-linking mechanisms. Integrations do not own business state.

## 15. Security
Least privilege, server-side authorization, audit logs, rate limits, secret isolation, private media, moderation and child-safety workflows are mandatory.

## 16. Engineering governance
Monorepo; protected main; one worktree per agent; PR gates; tests; docs; ADRs for foundational changes.

## 17. AI organization
Human Architect → AI CTO → domain leads → implementation agents → independent reviewers. Around 20 defined roles can be orchestrated in parallel.

## 18. AI workflow
Intake → Context → Architecture Gate → Plan → Parallel Build → Self Review → Peer Review → QA → Security → Architecture Review → AI CTO → Human Acceptance → Merge → Knowledge Update.

## 19. Definition of Ready
Architecture exists or a decision is approved; dependencies known; reuse checked; contracts defined; permissions/data impact understood; test plan exists.

## 20. Definition of Done
Implementation + tests + contracts/docs + migration safety + observability + security/child-safety checks + independent review + acceptance.

## 21. Phase roadmap
0 Workspace/AI team. 1 Family/Auth/Task. 2 Game loop/PWA. 3 Mobile/Camera. 4 Social/Messenger. 5 AI/Learning/Alice/Telegram/MAX. 6 Games/Marketplace/Community.

## 22. Foundation non-goals
No Kubernetes-first architecture, no unrestricted child discovery, no direct AI-to-DB access, no public marketplace without moderation, no production money rail in the foundation, no giant documentation file.

## 23. Authority docs
See `docs/DOCS_GRAPH.md`. Foundational changes require ADR and Human Architect approval.


## 24. Development scope control
Review outcomes are PASS, PASS_WITH_DISCOVERIES, REWORK or BLOCKED. New findings outside accepted scope become Discoveries and, after triage, separate tasks linked to the source task.

## 25. Delivery planning
Detailed phases, parallel workstreams, dependency graphs, implementation maps and responsibility matrices live under `docs/planning/`.

## 26. Task traceability
Every task has one primary executor, independent reviewer(s), gate owners and explicit source/dependency links. Scope changes are never hidden inside rework.

## 27. Repository authority
`docs/MASTER_SPEC.md` is the index. Detailed rules are authoritative only in the linked domain documents listed by `docs/DOCS_GRAPH.md`.
