# Permission System

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## Model
RBAC for coarse roles + policy checks for family/child/resource scope.

## Policy examples
Parent can approve child task within their family.
Child can read own task.
Child cannot read another child's money ledger.
Friend can read only shared achievements allowed by visibility settings.

## Enforcement
Server-side policy is authoritative. Client-side gating is UX only.

## Audit
Changes to roles, family membership, child communication policy and money ledger are audited.
