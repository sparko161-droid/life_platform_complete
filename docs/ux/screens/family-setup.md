# Parent — Family Setup

**Screen ID:** P-FAMILY-SETUP
**Owner:** UI/UX Lead + Family Domain Lead
**Review:** Child Safety + Security Engineering

## Purpose
Turn an authenticated adult with no family into one who has a family and
at least one child, then hand them to the dashboard.

This is the only screen a *bootstrap* session can reach. A parent who has
signed in but belongs to no family holds a session with no `familyId`
(`DISC-P1-031-1`, ADR-0006), so every family-scoped call fails closed for
them — creating a family is genuinely all they can do, enforced by the
API rather than by hiding buttons.

`01`–`17` numbered sketches remain the earlier product source;
`02-family-setup.md` no longer declares an id, per
`docs/adr/0005-canonical-screen-ids.md`.

## Data
Queries: none on entry — a bootstrap session has nothing to read yet.
Commands: `createFamily`, `addChildToFamily`, `provisionChildSession`.
Events: `FAMILY_CREATED`, `CHILD_ADDED`.
Permissions: an authenticated parent session. Adding a child additionally
requires the `CHILD_POLICY` capability, which a family owner holds by
virtue of ownership.
Source of truth: `families` / `child_profiles`.

## Actions
«Создать семью» → `createFamily` → family created, the session becomes
family-scoped → same screen, child step.
«Добавить ребёнка» → `addChildToFamily` → child profile created → same
screen, showing the child.
«Открыть доступ ребёнку» → `provisionChildSession` → a child session is
issued for that child's device → same screen, showing that access is
ready.
«Готово» → no command → `P-DASH`.

## States
Loading, no family yet, creating family, family created / no children,
adding child, child added, provisioning child access, child access ready,
validation error, network error, offline.

## Navigation
Every action either stays on this screen with a defined state change or
moves to `P-DASH`. A parent who lands here mid-setup resumes from what
already exists rather than starting over.

## Copy
Russian, from localization. A child's age is asked for as a birth year;
the supported range is 4–12 (`HD-P1-034-1`), and copy must not imply the
product supports ages it does not.

## Accessibility
Steps are separately labelled regions so a screen reader user can tell
where they are in setup. Controls meet the standard touch target.

## Analytics
Setup step completion may be counted. A child's display name and birth
year are `CHILD_PRIVATE` (`docs/security/data-classification.md`) and
must never be sent to analytics.

## Child safety
A child never enters a credential here, and never gets one. Access is
provisioned by the parent onto a device
(`docs/adr/0006-identity-and-session-model.md` D3) — there is nothing for
a child to be phished for, share, or lose.

## Acceptance
A parent holding a bootstrap session can create a family, add a child
whose age is inside the supported range, provision that child's access,
and reach the dashboard — with no manual intervention anywhere.
