# AI Team Workflow

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## Lifecycle
1. Intake
2. Context resolution
3. Architecture Gate
4. Task planning
5. Parallel implementation
6. Self-review
7. Peer review
8. QA
9. Architecture review
10. Security/safety review
11. AI CTO synthesis
12. Human decision where required
13. Merge
14. Knowledge update

## Parallel work
Each agent owns a worktree. Shared contracts are published before dependent implementation branches begin.

## Handoff
Use a fixed handoff format: goal, files, contracts, tests, risks, decisions, next tasks.

## Conflict
Architecture conflicts stop implementation. Product ambiguity goes to Product/Architect. Safety ambiguity goes to Safety + Human Architect.
