# Family Lifecycle

**Owner:** Family Domain Architect
**Review:** Security, QA

## States
PENDING_INVITE → ACTIVE → SUSPENDED → ARCHIVED.

A family may have one or more authorized parents and one or more children.

## Second parent
A primary parent creates an invitation with scoped family access. The invitee must authenticate, accept and complete required consent/verification before membership becomes ACTIVE.

## Child membership
A child belongs to exactly one active family context at a time. Transfer/archive is an explicit audited operation.

## Parent authority
Parent roles are capability-based, not simply boolean admin flags. Sensitive capabilities include child policy, money/rewards, social permissions, chat visibility and account deletion.

## Join/leave
Every membership mutation produces an audit event. Revocation immediately invalidates protected access tokens/session grants.

## Acceptance
Registration → parent verification → child creation → optional second-parent invitation → permissions review → first task setup.
