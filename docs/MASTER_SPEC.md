# Master Specification — «Жизнь»

**Version:** 0.4
**Status:** Foundation / Architecture Baseline
**Owner:** Human Architect / Product Owner

## 1. Mission
«Жизнь» — Russian-language family platform where real-life responsibilities, learning, sport and social interaction become an age-appropriate game.

## 2. Core principles
1. Real life is the primary game world.
2. Child is the player; parent owns family rules.
3. Money is optional, not the only motivator.
4. Parent policy overrides recommendations.
5. Child safety/privacy are architectural constraints.
6. Parent and child social graphs are separate.
7. Domain rules are server-authoritative.
8. AI proposes/assists; humans control durable child, safety and money decisions.
9. CV senses; deterministic engines decide exercise verification.
10. New domains need an architecture contract before implementation.
11. Documentation is a graph of short authoritative files.
12. Parallel AI development uses independent review and explicit handoffs.

## 3. Product domains
Identity, Family, Tasks, Rules, Quests, Verification, Exercise, Economy, Rewards, Games, Social, Messenger, Notifications, Media, Learning, Development Profile, AI, Avatar, Knowledge Base, Content, Marketplace, Safety, Analytics, Integrations, Admin.

## 4. Client surfaces
Child PWA, Parent Web, Admin Web, Flutter Android/iOS, Telegram Mini App/Bot, MAX Mini App/Bot, Alice skill.

## 5. Technical stack
TypeScript/Node.js, React/Next.js, Tailwind/shared design system, NestJS, PostgreSQL, Redis, BullMQ, WebSocket, S3-compatible storage, REST/OpenAPI, Flutter/Dart, Docker, CI/CD, OpenTelemetry/Sentry-class observability.

## 6. Architecture shape
Start as modular monolith + workers + realtime. Extract services only by ADR and evidence.

## 7. Data rules
PostgreSQL is source of truth. Money uses append-only ledger. Media lives outside PostgreSQL. Child access is family/policy scoped.

## 8. Task Engine
Task = content + schedule + rules + verification + reward + gameplay + notifications. Initial verification includes MANUAL_SELF, PARENT_APPROVAL, PHOTO_PROOF, VIDEO_PROOF, CAMERA_EXERCISE, TIMER, COUNTER, AUDIO_PROOF, ALICE_SESSION and COMPOSITE.

## 9. Task Builder / Rules
Task templates are versioned DSL objects. Composite tasks support ordered/parallel children and ALL/ANY/COUNT/SCORE/PARENT_DECISION completion. Family edits create local versions; global templates remain immutable.

## 10. Verification
Task → Verification → Result → Event/Reward. Camera uses Camera → PoseProvider → landmarks → overlay → deterministic ExerciseEngine → result. Raw exercise video is not stored by default.

## 11. Game / Economy
XP, Coins, Money Ledger, Coupons, Levels, Streaks, Skills, Achievements and Game Sessions are distinct. Rewards may be money, screen time, device time, activities or custom coupons.

## 12. Social / Messenger
Parent, Child, Family and Group graphs are separate. Discovery is consented. Parent visibility of child chats is configurable. Competition is optional and uses safe age-banded metrics.

## 13. Learning / AI
Development Profile stores evidence provenance and confidence. AI may summarize and propose age-appropriate practice but cannot diagnose. AI Gateway hides providers; tools are typed and policy-checked. Avatar generation is moderated and separated from private media.

## 14. Integrations
Telegram/MAX are web adapters; Alice is a skill adapter. Integrations never own domain state.

## 15. Security
Least privilege, server-side authorization, audit logs, rate limits, private media, moderation and child-safety workflows are mandatory.

## 16. Engineering governance
Monorepo; protected main; one worktree per agent; PR gates; tests; docs; ADRs; frozen contracts for parallel streams.

## 17. AI organization
Human Architect → AI CTO → leads → implementation agents → independent reviewers. Around 20 defined roles are orchestrated by task and domain.

## 18. AI workflow
Intake → Context → Architecture Gate → Plan → Parallel Build → Self Review → Peer Review → QA → Security/Safety → Architecture Review → AI CTO → Human Acceptance → Merge → Knowledge Update.

## 19. Findings
PASS, PASS_WITH_DISCOVERIES, REWORK, BLOCKED. Scope defects return to the current task; new requirements/gaps become linked Discoveries and separate tasks after triage.

## 20. Definition of Ready
Architecture/decision exists; dependencies and reuse checked; contracts, permissions, data impact and test plan are defined; downstream handoff is clear.

## 21. Definition of Done
Implementation + tests + contracts/docs + migration safety + observability + security/child-safety + independent review + acceptance + knowledge update.

## 22. Phase roadmap
0 Engineering/AI workspace. 1 Family/Auth/Task core. 2 Game loop/PWA. 3 Mobile/CV. 4 Social/Messenger/Safety. 5 AI/Learning/Integrations. 6 Games/Marketplace/Community. 7 Hardening/Beta/Production.

## 23. Foundation non-goals
No Kubernetes-first architecture, unrestricted child discovery, direct AI-to-DB access, unmoderated public marketplace, production money rail in foundation or giant documentation files.

## 24. Authority
MASTER_SPEC is the index; domain docs are authoritative for details. Foundational changes require ADR and Human Architect approval.
