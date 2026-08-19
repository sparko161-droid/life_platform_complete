# ADR-0006 Identity and Session Model

**Status:** Accepted
**Owner:** Chief Architect
**Depends on:** docs/architecture/domain-map.md, docs/product/actors-and-permissions.md, docs/product/family-lifecycle.md
**Related:** tasks/packets/P1-IDENTITY-domain-pack.md, packages/domain-types/src/identity.ts, DISC-P1-010-1, P1-029

## Context

`docs/architecture/domain-map.md` lists Identity first and states
"Identity/Family → nearly all domains." P0-009's contract pack froze
Family, Task, Verification, Media and Reward — and never covered it.

The gap was load-bearing, not cosmetic. It surfaced during P1-010 as
"there is no login endpoint", and investigation showed the real shape:

- No Account, Credential or Session entity existed anywhere in
  `packages/domain-types`. Neither `ParentMembership` nor `ChildProfile`
  carried a credential field.
- `family-service.ts` stated the assumption in a comment — *"createFamily:
  any authenticated parent"* — with nothing defining what that is.
- `ParentId` was a branded UUID that originated nowhere.
- P1-025's authorization resolved `actorId` against `parent_memberships`,
  but nothing established that the caller **was** that actor, except a
  JWT only tests minted.
- `docs/product/family-lifecycle.md` already promised two things nothing
  implemented: *"The invitee must authenticate, accept and complete
  required consent/verification"* and *"Revocation immediately
  invalidates protected access tokens/session grants."*

Four existing frozen contracts constrained the solution before any
choice was made, and deriving from them is what kept this decision small:

1. **A child has no credentials.** `ChildProfileSchema` carries
   `childId`, `familyId`, `displayName`, `birthYear`, `avatarId` — no
   email, no password — and `data-architecture.md` requires child PII be
   minimal.
2. **Family is the security boundary**, and authorization already
   resolves `actor → family scope → child scope → resource → policy →
   action`. Identity supplies only the first hop.
3. **A parent authenticates before accepting an invitation**, so parent
   identity exists independently of, and prior to, family membership.
4. **Revocation must invalidate live sessions.**

## Decision

### D1 — Identity is in-house for Phase 1, with a provider seam

Own the account and credential model rather than delegating to an
external IdP now. `Account` carries an `authProvider` discriminator from
day one (`PASSWORD` in Phase 1), so adding Alice/Telegram/MAX as identity
providers later — all already named as surfaces in MASTER_SPEC — is an
additive enum change rather than a breaking reshape.

### D2 — Server-side session records, not bearer-JWT-only

A `Session` is a persisted record, referenced by an opaque identifier in
the httpOnly cookie. The API validates against the record.

This follows from constraint (4) and is not a preference. A stateless
JWT is valid until it expires, by construction — revoking a parent's
membership could not cut their live session, and the product
documentation already promises otherwise.

### D3 — Child access is parent-provisioned, never a child credential

Derived from constraint (1), not chosen freely. A `CHILD` session
requires `issuedByParentId`, enforced by the schema rather than left to
the application layer to remember, and must not carry an `accountId`.
There is no path that mints a child session from a child-supplied
credential, because no such credential exists.

### D4 — Credential handling and scope line

Argon2id, encoded PHC string including its own salt and parameters,
stored on a `CredentialRecord` separate from `Account` — the aggregate
read during ordinary authorization never contains the hash, so ordinary
authorization cannot leak it. `passwordHash` is classified `SECRET`, the
first use of that class in this contract pack.

**Password reset, MFA and account recovery are explicitly out of Phase 1
scope** — the same line `BLK-P1-006-007-persistence-api-pack.md` drew for
the API layer, kept consistent rather than quietly widened.

## Alternatives

- **Delegate to an external IdP now.** Rejected: Phase 1 has no
  production deployment and no completed legal review
  (`docs/security/legal-ru.md`). Choosing a provider before either is a
  bet, not a decision. D1's seam keeps the option open at additive cost.
- **Stateless JWT only, accept that revocation lags until expiry.**
  Rejected: it contradicts a promise the product documentation already
  makes, and shortening expiry to compensate trades one defect for
  another (constant re-authentication on a child's shared device).
- **Give children their own credentials.** Rejected: it would require
  changing a frozen contract (`ChildProfile` has no credential fields)
  and contradicts `data-architecture.md`'s minimal-child-PII rule. It
  also creates something a 4-year-old can lose or share — the target age
  range is 4–12 (HD-P1-034-1).
- **One `Account` per person including children, with a role flag.**
  Rejected: it makes "child has no credential" an application-layer
  convention rather than a structural guarantee. The parent/child
  asymmetry is enforced by `SessionSchema` precisely so it cannot be
  forgotten.

## Consequences

- **One datastore read per authenticated request.** Accepted knowingly
  at Phase 1 scale. `data-architecture.md` already names Redis for
  "short-lived state" if this needs to move; `packages/scale-guardrails`
  is where that would be tracked.
- `services/api/src/auth/session.ts` currently verifies a signed JWT;
  that becomes a session-record lookup in P1-030. `@life/web-session`'s
  cookie handling is unaffected — it never cared what the opaque value
  was, which is why it was built that way.
- `revokeParent` gains a real obligation: it must revoke that parent's
  live sessions. Until P1-030 implements it, the promise in
  `family-lifecycle.md` remains unmet and is tracked there.
- Adding these entities bumps the contract pack. The change is additive,
  and `@life/versioning`'s `checkSchemaCompatibility` is used to prove
  that rather than assert it.
- `Account.consentAcceptedAt` contracts the *flag*, deliberately not the
  *policy*. What is consented to, under which rule, is a legal question
  owned by P1-034 — and per `docs/security/legal-ru.md` no compliance
  claim follows from this ADR.

## Reversal plan

The seam is `authProvider`. Moving to an external IdP means adding a
provider value and a resolution path from provider subject → `parentId`;
`Account` keeps its shape, and `ParentMembership`/`Family` never referenced
credentials, so nothing downstream of identity has to change.

Reversing D2 (back to stateless tokens) is the expensive direction: it
would mean withdrawing the revocation guarantee, which is a product
promise, not just a technical one — so it requires a product decision,
not only an architectural one.

## Revisit when

- A second identity provider is genuinely needed (Phase 5 integrations).
- Session lookup shows up as a real bottleneck in
  `packages/scale-guardrails`' measurements — not before.
- External counsel review (HD-P1-033-2, still open) changes what consent
  or account data must be captured.
