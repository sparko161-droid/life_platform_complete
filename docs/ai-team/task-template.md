# AI Task Contract

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## Required fields
- Task ID
- Goal
- User value
- Domain owner
- Acceptance criteria
- Out of scope
- Dependencies
- Architecture references
- API/events affected
- Data migration impact
- Security/privacy impact
- Test plan
- Rollback plan
- Human decisions required

## State machine
BACKLOG → ANALYSIS → ARCHITECTURE_CHECK → READY → IN_PROGRESS → REVIEW → QA → SECURITY → ACCEPTANCE → DONE.

## Blocked states
ARCHITECTURE_BLOCKED, PRODUCT_BLOCKED, SECURITY_BLOCKED, DEPENDENCY_BLOCKED.
