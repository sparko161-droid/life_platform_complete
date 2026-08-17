# Project Evolution & Revalidation

**Owner:** Human Architect / AI CTO

## Rule
Documentation is a living engineering contract. Do not expand it for its own sake.

## Phase cycle
1. Prepare: contracts, risks, dependencies, tasks.
2. Build: parallel streams under frozen contracts.
3. Review: tests, architecture, security, UX and discovery checks.
4. Revalidate: compare real implementation with authoritative docs.
5. Learn: record only confirmed gaps, decisions and evidence.
6. Update: change the smallest authoritative documents needed.
7. Continue: start the next phase only after exit criteria pass.

## Mandatory revalidation points
- After Phase 0: inspect the real AI workspace, Git flow, CI, gates and handoffs.
- After the first vertical slice: inspect real UI/API/domain/event/reward behavior end to end.
- Before Phase 2: review game loop, progression, economy and daily load using implementation evidence.
- Before Phase 3: validate mobile, camera, offline and device capability assumptions on real devices.
- Before Phase 4: revalidate social permissions, moderation, chat, privacy and notification flows.
- Before Phase 5: revalidate AI boundaries, learning evidence, integrations and provider abstraction.
- Before Beta: full product, architecture, security, privacy, UX, performance and operations audit.
- After Beta: evidence-driven architecture and product revision.

## Documentation update rules
Update Master Spec only for foundational changes, new domains, major product direction or proven architectural change.
Update domain docs for normal behavior, contracts and detailed rules.
Use ADR for durable architectural decisions.
Use Discovery + task for new implementation work.
Never rewrite history to hide newly discovered scope.

## Stop rule
If a decision is already authoritative and implementation does not invalidate it, do not reopen it.
If two agents interpret the same rule differently, stop the affected work and resolve the contract before merging.
