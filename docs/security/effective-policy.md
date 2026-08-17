# Effective policy

**Owner:** Security/Child Safety + Chief Architect

Permissions are evaluated as an effective policy from multiple layers.

## Resolution order
`Platform safety rules → age rules → family policy → child policy → relationship/context policy → operation check`.

More specific settings may narrow permissions but may not weaken a mandatory platform safety rule.

## Examples
Child chat can be enabled by platform, restricted by family to approved friends, and disabled by the child profile for voice messages.

A parent may view a child conversation only when the family policy and the current access mode allow it.

A device integration may know a child task status only for the linked child and only for capabilities explicitly granted.

## Rules
- Authorization is checked server-side on every protected command/query.
- UI visibility is never an authorization mechanism.
- Policy decisions are auditable when they affect child safety, money or privacy.
- Policy changes produce a new effective version for subsequent operations.

## Acceptance
Security tests prove narrower family/child policies cannot bypass platform safeguards and stale clients cannot use revoked permissions.