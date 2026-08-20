# Parent — Registration and Sign-in

**Screen ID:** P-REGISTRATION
**Owner:** UI/UX Lead + Backend Lead
**Review:** Security Engineering + Child Safety

## Purpose
The product's entry point. Let an adult create an account or sign in, and
nothing more — this screen deliberately does not know about families,
children or tasks.

It exists as a frozen contract from P1-032 rather than earlier because
`docs/adr/0005-canonical-screen-ids.md` requires a template-conformant
contract before a screen enters `SCREEN_IDS`, and until the sign-in flow
was actually built there was nothing real to write it against
(`01-parent-registration.md` remains as the earlier product sketch).

## Data
Queries: none — an unauthenticated screen holds no server state.
Commands: `signUp`, `signIn` (`services/api/openapi/openapi.yaml`).
Events: none emitted client-side.
Permissions: none required; this is the only parent surface reachable
without a session.
Source of truth: the `accounts` table via the identity API.

## Actions
«Создать аккаунт» → `signUp` → account created in `PENDING_VERIFICATION`
→ stays on this screen in a state asking for consent.
«Войти» → `signIn` → a session cookie is set server-side → `P-DASH` when
the session is family-scoped, `P-FAMILY-SETUP` when it is a bootstrap
session (the parent belongs to no family yet).

## States
Loading, ready, submitting, validation error, sign-in failed, too many
attempts, network error, offline.

`sign-in failed` is deliberately one state, not several. The API returns
the same failure for a wrong password, an unknown email, a suspended
account and a non-member, because distinguishing them would let anyone
discover which addresses are registered. The UI must not reintroduce that
distinction by guessing.

## Navigation
Successful sign-in leaves this screen. Every failure stays on it with a
state change — there is no dead end and no silent redirect.

## Copy
All visible text is Russian and comes from localization
(`docs/ux/ui-language.md`, enforced by `@life/ui-language`). Error copy
never names a technical cause: a failed sign-in says it did not work, not
which half was wrong.

## Accessibility
Both fields are labelled and reachable by keyboard in order. The submit
control meets the standard touch target. Errors are announced politely
via the shared `StateBanner`, not only shown in colour.

## Analytics
Attempt outcomes may be counted; the email, the password and any part of
either must never leave the client as analytics data.

## Acceptance
A person with no account can create one, accept consent, sign in, and
arrive at the right next screen depending on whether they already belong
to a family.
