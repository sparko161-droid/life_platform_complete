import { z } from "zod";
import { AccountId, ChildId, FamilyId, ParentId, SessionId } from "./ids.js";
import type { ClassificationMap } from "./classification.js";

/**
 * Identity contract (P1-029). See tasks/packets/P1-IDENTITY-domain-pack.md
 * and docs/adr/0006-identity-and-session-model.md.
 *
 * `docs/architecture/domain-map.md` lists Identity first and says
 * "Identity/Family -> nearly all domains", but P0-009's contract pack
 * froze Family/Task/Verification/Media/Reward and never covered it.
 * `family-service.ts` states the resulting assumption out loud --
 * "createFamily: any authenticated parent" -- with nothing defining what
 * an authenticated parent is. This module closes that: it is where a
 * `ParentId` finally comes from.
 *
 * Scope boundary, deliberate and confirmed (packet D4): password reset,
 * MFA and account recovery are NOT modelled here. That is the same line
 * `tasks/packets/BLK-P1-006-007-persistence-api-pack.md` drew for the API
 * layer, kept consistent rather than quietly widened.
 *
 * Identity supplies only the first hop of
 * `actor -> family scope -> child scope -> resource -> policy -> action`
 * (docs/product/actors-and-permissions.md). It must not duplicate the
 * rest -- an Account says who you are, `ParentMembership` says what you
 * may do.
 */

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

/**
 * The seam for future external identity (packet D1). Phase 1 ships
 * `PASSWORD` only, but the discriminator exists from day one so adding
 * Alice/Telegram/MAX as identity providers -- all already named as
 * surfaces in MASTER_SPEC -- is an additive enum change rather than a
 * breaking reshape of Account.
 */
export const AUTH_PROVIDERS = ["PASSWORD"] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

/**
 * `PENDING_VERIFICATION` exists because docs/product/family-lifecycle.md
 * already requires it -- "The invitee must authenticate, accept and
 * complete required consent/verification before membership becomes
 * ACTIVE". `SUSPENDED` is an operator/safety action; `CLOSED` is
 * terminal.
 */
export const ACCOUNT_STATUSES = ["PENDING_VERIFICATION", "ACTIVE", "SUSPENDED", "CLOSED"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

const ACCOUNT_TRANSITIONS: Record<AccountStatus, AccountStatus[]> = {
  PENDING_VERIFICATION: ["ACTIVE", "CLOSED"],
  ACTIVE: ["SUSPENDED", "CLOSED"],
  SUSPENDED: ["ACTIVE", "CLOSED"],
  CLOSED: [],
};
export function isValidAccountTransition(from: AccountStatus, to: AccountStatus): boolean {
  return from !== to && (ACCOUNT_TRANSITIONS[from]?.includes(to) ?? false);
}

/**
 * An adult account. There is deliberately **no child account**: a
 * `ChildProfile` carries no credentials by contract, and
 * docs/architecture/data-architecture.md requires child PII be kept
 * minimal. Child access is parent-provisioned (see `Session` below), so
 * there is nothing for a child to lose, share, or have phished.
 *
 * `email` is the login identifier for `PASSWORD` accounts. It is
 * `PARENT_PRIVATE`, never `FAMILY`: the other parent in a family has no
 * need for it, and family scope is not an access grant to a person's
 * login identifier.
 *
 * Credential material is **not** on this schema -- see `CredentialRecord`.
 * Keeping the hash off the aggregate that gets read on every
 * authorization check is what stops it being logged, serialised into an
 * event payload, or returned by an API that forgot to project.
 */
export const AccountSchema = z.object({
  accountId: AccountId,
  /**
   * The ParentId this account authenticates as. One account, one parent
   * identity -- the split exists so a future provider-backed account can
   * point at the same ParentId without changing every Family reference.
   */
  parentId: ParentId,
  email: z.string().email(),
  authProvider: z.enum(AUTH_PROVIDERS),
  status: z.enum(ACCOUNT_STATUSES),
  /**
   * Consent/verification state required by family-lifecycle.md. The flag
   * is contracted here; its *content* (what is consented to, under which
   * rule) is a legal question owned by P1-034 and deliberately not
   * encoded as engineering policy.
   */
  consentAcceptedAt: z.string().datetime().optional(),
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
});
export type Account = z.infer<typeof AccountSchema>;

export const ACCOUNT_CLASSIFICATION: ClassificationMap<keyof Account> = {
  accountId: "PARENT_PRIVATE",
  parentId: "FAMILY",
  // The login identifier. SENSITIVE would overclassify (it is not a
  // safety/moderation record) but FAMILY would underclassify -- a
  // co-parent has no need for another adult's login email.
  email: "PARENT_PRIVATE",
  authProvider: "PARENT_PRIVATE",
  status: "PARENT_PRIVATE",
  consentAcceptedAt: "PARENT_PRIVATE",
  version: "PARENT_PRIVATE",
  createdAt: "PARENT_PRIVATE",
};

// ---------------------------------------------------------------------------
// Credential
// ---------------------------------------------------------------------------

/**
 * Argon2id per packet D4. Named as an enum rather than assumed so that
 * a future algorithm migration is a visible contract change and old
 * records stay interpretable -- exactly what
 * docs/architecture/versioning-and-compatibility.md rule 2 requires of
 * persisted data.
 */
export const CREDENTIAL_ALGORITHMS = ["ARGON2ID"] as const;
export type CredentialAlgorithm = (typeof CREDENTIAL_ALGORITHMS)[number];

/**
 * Separated from `Account` on purpose. This record is loaded only by the
 * sign-in path; nothing else has a reason to read it, and a schema that
 * is never loaded during ordinary authorization cannot be leaked by
 * ordinary authorization.
 *
 * `passwordHash` is `SECRET`, the class
 * docs/security/data-classification.md reserves for "credentials,
 * tokens, keys and signing material" -- the first use of that class in
 * this contract pack.
 */
export const CredentialRecordSchema = z.object({
  accountId: AccountId,
  algorithm: z.enum(CREDENTIAL_ALGORITHMS),
  /** Encoded hash string including its own salt and parameters (Argon2id PHC format). */
  passwordHash: z.string().min(1),
  updatedAt: z.string().datetime(),
});
export type CredentialRecord = z.infer<typeof CredentialRecordSchema>;

export const CREDENTIAL_RECORD_CLASSIFICATION: ClassificationMap<keyof CredentialRecord> = {
  accountId: "PARENT_PRIVATE",
  algorithm: "PARENT_PRIVATE",
  passwordHash: "SECRET",
  updatedAt: "PARENT_PRIVATE",
};

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

/**
 * Who a session acts as. `system` is not represented here -- the
 * Verification Engine is a service principal, not a user
 * (docs/product/actors-and-permissions.md: "AI agents are service
 * principals, not users"), and giving it a Session row would make it
 * look like one.
 */
export const SESSION_SUBJECT_KINDS = ["PARENT", "CHILD"] as const;
export type SessionSubjectKind = (typeof SESSION_SUBJECT_KINDS)[number];

/**
 * A server-side session record (packet D2).
 *
 * This exists as a *record* rather than a self-contained signed token
 * for one concrete reason: docs/product/family-lifecycle.md promises
 * "Revocation immediately invalidates protected access tokens/session
 * grants." A stateless JWT is valid until it expires, by construction --
 * revoking a parent's membership could not cut their live session. A
 * record can be revoked; a signature cannot be un-signed.
 *
 * The cost is one lookup per authenticated request, accepted knowingly
 * at Phase 1 scale (see ADR-0006's consequences).
 *
 * A CHILD session is always parent-provisioned: `issuedByParentId` is
 * required for it, so a child session can always be traced to the adult
 * who authorised it. There is no path that mints a child session from a
 * child-supplied credential, because no such credential exists.
 */
export const SessionSchema = z
  .object({
    sessionId: SessionId,
    subjectKind: z.enum(SESSION_SUBJECT_KINDS),
    /** Present for PARENT sessions; a child has no Account. */
    accountId: AccountId.optional(),
    parentId: ParentId.optional(),
    childId: ChildId.optional(),
    familyId: FamilyId,
    /** Required for CHILD sessions: the parent who provisioned this device. */
    issuedByParentId: ParentId.optional(),
    issuedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    revokedAt: z.string().datetime().optional(),
  })
  .check((ctx) => {
    const v = ctx.value;
    if (v.subjectKind === "PARENT") {
      if (!v.accountId || !v.parentId) {
        ctx.issues.push({
          code: "custom",
          message: "A PARENT session requires accountId and parentId",
          input: v,
          path: ["subjectKind"],
        });
      }
      if (v.childId) {
        ctx.issues.push({ code: "custom", message: "A PARENT session must not carry childId", input: v, path: ["childId"] });
      }
    } else {
      if (!v.childId) {
        ctx.issues.push({ code: "custom", message: "A CHILD session requires childId", input: v, path: ["childId"] });
      }
      // The provisioning rule, enforced by the contract rather than left
      // to the application layer to remember.
      if (!v.issuedByParentId) {
        ctx.issues.push({
          code: "custom",
          message: "A CHILD session requires issuedByParentId -- child access is always parent-provisioned",
          input: v,
          path: ["issuedByParentId"],
        });
      }
      if (v.accountId) {
        ctx.issues.push({
          code: "custom",
          message: "A CHILD session must not carry accountId -- a child has no Account by contract",
          input: v,
          path: ["accountId"],
        });
      }
    }
  });
export type Session = z.infer<typeof SessionSchema>;

export const SESSION_CLASSIFICATION: ClassificationMap<
  keyof Omit<Session, never>
> = {
  // The session id is the bearer value itself -- whoever holds it can
  // act as the subject, which is the definition of SECRET in
  // data-classification.md.
  sessionId: "SECRET",
  subjectKind: "FAMILY",
  accountId: "PARENT_PRIVATE",
  parentId: "FAMILY",
  childId: "CHILD_PRIVATE",
  familyId: "FAMILY",
  issuedByParentId: "FAMILY",
  issuedAt: "FAMILY",
  expiresAt: "FAMILY",
  revokedAt: "FAMILY",
};

/** True when a session is usable at `now`: not revoked and not expired. */
export function isSessionActive(session: Session, now: string): boolean {
  if (session.revokedAt) return false;
  return new Date(now) < new Date(session.expiresAt);
}
