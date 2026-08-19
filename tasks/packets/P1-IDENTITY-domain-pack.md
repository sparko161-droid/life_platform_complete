# P1 Identity — Account, Credential and Session Domain Pack

**Status:** ADOPTED — D1 (in-house identity with a provider seam), D2 (server-side sessions) and D4 (password reset / MFA / recovery stay out of Phase 1) confirmed by the Human Architect.
**Owner:** chief-architect (packet drafted by ai-cto)
**Source:** DISC-P1-010-1 (rescoped)
**Depends on:** P0-009 (contract pack), P1-001 (family lifecycle), P1-025/P1-026 (the authorization layer that already assumes this exists)
**Unblocks:** P1-016, and thereby P1-003/P1-004's live-data half, P1-011, P1-017, P1-018, P1-007

## The gap

`docs/architecture/domain-map.md` lists **Identity** first and says
"Identity/Family → nearly all domains." P0-009's contract pack froze
Family, Task, Verification, Media and Reward — and never covered it.

The consequence is load-bearing, not cosmetic:

- `packages/domain-types` has no Account, Credential or Session entity.
  Neither `ParentMembership` nor `ChildProfile` carries a credential
  field.
- `family-service.ts` states the assumption in a comment —
  *"createFamily: any authenticated parent"* — with nothing defining
  what an authenticated parent is.
- `ParentId` is a branded UUID that originates nowhere.
- P1-025's authorization resolves `actorId` against
  `parent_memberships`, but nothing establishes that the caller **is**
  that actor, except a JWT only tests mint.
- `docs/product/family-lifecycle.md` already promises two things nothing
  implements: *"The invitee must authenticate, accept and complete
  required consent/verification"* and *"Revocation immediately
  invalidates protected access tokens/session grants."*

## What the existing contracts already decide (not re-opened here)

These are constraints, not choices — deriving from them is what keeps
this packet small:

1. **A child has no credentials.** `ChildProfileSchema` has
   `childId`, `familyId`, `displayName`, `birthYear`, `avatarId` — no
   email, no password, and `docs/architecture/data-architecture.md` says
   "Keep child PII minimal." So child access **must** be
   parent-provisioned. Anything else changes a frozen contract.
2. **Family is the security boundary** (actors-and-permissions.md), and
   authorization already resolves
   `actor → family scope → child scope → resource → policy → action`.
   Identity supplies only the first hop; it must not duplicate the rest.
3. **A parent authenticates before accepting an invitation**
   (family-lifecycle.md), so parent identity exists independently of,
   and prior to, family membership. Account ≠ ParentMembership.
4. **Revocation must invalidate live sessions** — which a stateless JWT
   alone cannot do. This forces a server-side session record, not just a
   signed token.

## Proposed decisions

### D1 — Identity is in-house for Phase 1, with a provider seam

Own the account and credential model rather than delegating to an
external IdP now. MASTER_SPEC's Phase 5 anticipates Alice/Telegram/MAX
integrations, any of which could later be an identity provider, so the
`Account` contract carries an explicit `authProvider` discriminator from
day one (`PASSWORD` today) rather than assuming password-only and
needing a breaking change later.

*Rejected:* delegate to an external IdP now — Phase 1 has no production
deployment, no legal review completed (`docs/security/legal-ru.md`), and
picking a provider before those is a bet, not a decision.

### D2 — Server-side sessions, not bearer-JWT-only

A `Session` record persisted server-side, referenced by an opaque
identifier in the httpOnly cookie. The API validates against the record.

This is the only way to honour family-lifecycle.md's *"Revocation
immediately invalidates protected access tokens/session grants."* A
stateless JWT is valid until it expires, by construction — revoking a
parent's membership could not cut their live session.

*Cost, stated plainly:* one datastore read per authenticated request.
Acceptable at Phase 1 scale, and `docs/architecture/data-architecture.md`
already names Redis for "short-lived state" if it needs to move later.

*Migration note:* `services/api/src/auth/session.ts` currently verifies a
signed JWT. That becomes session-record lookup; `@life/web-session`'s
cookie handling is unaffected — it never cared what the opaque value was,
which is why it was built that way.

### D3 — Child access is parent-provisioned, never a child credential

Derived from constraint (1), not chosen freely. A parent provisions
child access from their own authenticated session; the child's device
gets a session bound to `childId` + `familyId` with `role: "child"`.
No child password, no child email, nothing for a child to lose or share.

The exact provisioning mechanism (short-lived pairing code vs
parent-driven device handoff) is an **implementation choice inside this
decision**, not a separate architectural one.

### D4 — Credential handling

Argon2id password hashing, per-account salt, never reversible. Password
reset, MFA and account recovery are **explicitly out of Phase 1 scope**
and recorded as such — the same boundary
`tasks/packets/BLK-P1-006-007-persistence-api-pack.md` drew, kept
consistent rather than quietly widened.

## Proposed task breakdown

| id (proposed) | title | primary | reviewer | why separate |
|---|---|---|---|---|
| P1-029 | Freeze the Identity contract (Account, Credential, Session) | chief-architect | security-engineering | A frozen contract + ADR is its own reviewable artifact, and every task below consumes it. |
| P1-030 | Identity persistence, session lifecycle and revocation | backend-lead | security-engineering | Schema, repository, session issue/validate/revoke, and wiring revocation into `revokeParent`. |
| P1-031 | Sign-in/sign-up API operations and screen contracts | backend-lead | uiux-lead | New `openapi.yaml` operations + the missing frozen screen contract (`P-FAMILY-SETUP` is named but unspecified). |
| P1-032 | Web sign-in flow and child provisioning | frontend-lead | security-engineering | The Next route handler that sets the httpOnly cookie, plus both surfaces' entry screens. |

Sequential — each genuinely needs the previous.

## Decisions confirmed

1. **D1** — in-house identity for Phase 1, with an `authProvider`
   discriminator on `Account` as the seam for a future external
   provider. Approved.
2. **D2** — server-side session records, accepting one lookup per
   authenticated request, because a stateless JWT cannot honour the
   revocation promise `family-lifecycle.md` already makes. Approved.
3. **D4** — password reset, MFA and account recovery stay out of Phase 1.
   Approved.

## ADR

`docs/adr/README.md` lists "major security/privacy decision" as a
mandatory ADR trigger. D1–D4 will be recorded as **ADR-0006 Identity and
Session Model** as part of P1-029, not left in this packet.

## Known risks

- **Legal review is not done.** `docs/security/legal-ru.md` requires
  counsel review for personal data, minors and consent flows before
  public launch. This packet builds the mechanism; it makes no
  compliance claim, per that doc's own rule.
- Consent/verification (`family-lifecycle.md`: *"complete required
  consent/verification"*) is modelled as a state on the account but its
  **content** is a legal question, not an engineering one — the
  contract carries the flag, deliberately not the policy.
- Adding `Account` bumps the contract pack (`contracts/registry.yaml`
  `contract_pack_version`), and `packages/versioning`'s
  `checkSchemaCompatibility` should be run against it — additive, so it
  should pass, and that is worth proving rather than assuming.
