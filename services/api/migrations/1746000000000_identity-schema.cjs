/**
 * Identity schema (P1-030), implementing the contract frozen by P1-029
 * (packages/domain-types/src/identity.ts) and the decisions in
 * docs/adr/0006-identity-and-session-model.md.
 *
 * Three tables, and the constraints carry the security rules rather than
 * leaving them to application code:
 *
 *   accounts     -- adult accounts only. UNIQUE(email) is the login
 *                   identifier; there is deliberately no child account
 *                   table, because a ChildProfile has no credentials by
 *                   contract.
 *   credentials  -- separate from accounts on purpose (ADR-0006 D4): the
 *                   row read during ordinary authorization never contains
 *                   the hash, so ordinary authorization cannot leak it.
 *                   PK is account_id -- one credential per account.
 *   sessions     -- server-side records, not bare signed tokens
 *                   (ADR-0006 D2). This is what makes
 *                   docs/product/family-lifecycle.md's promise
 *                   ("Revocation immediately invalidates protected access
 *                   tokens/session grants") implementable at all.
 *
 * The parent/child session asymmetry is enforced by CHECK constraints,
 * not only by the zod schema. A schema guards what the application
 * writes; a CHECK guards what the database will accept from anything --
 * a migration, a fix-up script, a future service. Given the rule is
 * "a child can never hold their own credential", it is worth having in
 * both places.
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  // -- accounts ---------------------------------------------------------
  pgm.createTable("accounts", {
    account_id: { type: "uuid", primaryKey: true },
    // Not a FK: a ParentId exists as an identity before it is a member of
    // any family (docs/product/family-lifecycle.md -- "The invitee must
    // authenticate, accept and complete required consent/verification
    // before membership becomes ACTIVE"), so an account can and must
    // exist with no parent_memberships row yet.
    parent_id: { type: "uuid", notNull: true, unique: true },
    email: { type: "text", notNull: true },
    auth_provider: {
      type: "text",
      notNull: true,
      check: "auth_provider IN ('PASSWORD')",
    },
    status: {
      type: "text",
      notNull: true,
      check: "status IN ('PENDING_VERIFICATION','ACTIVE','SUSPENDED','CLOSED')",
    },
    consent_accepted_at: { type: "timestamptz" },
    version: { type: "integer", notNull: true, default: 1 },
    created_at: { type: "timestamptz", notNull: true },
  });
  // Case-insensitive uniqueness: treating Parent@x and parent@x as two
  // accounts is an account-takeover foothold, not a feature.
  pgm.createIndex("accounts", "LOWER(email)", { unique: true, name: "accounts_email_lower_unique" });

  // -- credentials ------------------------------------------------------
  pgm.createTable("credentials", {
    account_id: {
      type: "uuid",
      primaryKey: true,
      references: "accounts(account_id)",
      onDelete: "CASCADE",
    },
    algorithm: {
      type: "text",
      notNull: true,
      check: "algorithm IN ('ARGON2ID')",
    },
    // Encoded PHC string; carries its own salt and parameters, so an
    // algorithm/parameter migration does not invalidate existing rows
    // (docs/architecture/versioning-and-compatibility.md rule 2).
    password_hash: { type: "text", notNull: true },
    updated_at: { type: "timestamptz", notNull: true },
  });

  // -- sessions ---------------------------------------------------------
  pgm.createTable("sessions", {
    session_id: { type: "uuid", primaryKey: true },
    subject_kind: {
      type: "text",
      notNull: true,
      check: "subject_kind IN ('PARENT','CHILD')",
    },
    account_id: { type: "uuid", references: "accounts(account_id)", onDelete: "CASCADE" },
    parent_id: { type: "uuid" },
    child_id: { type: "uuid" },
    family_id: { type: "uuid", notNull: true, references: "families(family_id)" },
    issued_by_parent_id: { type: "uuid" },
    issued_at: { type: "timestamptz", notNull: true },
    expires_at: { type: "timestamptz", notNull: true },
    revoked_at: { type: "timestamptz" },
  });

  // The asymmetry from ADR-0006 D3, as a database rule:
  //  - a PARENT session has an account and a parent, and no child;
  //  - a CHILD session has a child and a provisioning parent, and NO
  //    account -- there is no way to record a child holding a credential.
  pgm.addConstraint(
    "sessions",
    "sessions_subject_shape",
    `CHECK (
      (subject_kind = 'PARENT'
        AND account_id IS NOT NULL
        AND parent_id IS NOT NULL
        AND child_id IS NULL)
      OR
      (subject_kind = 'CHILD'
        AND child_id IS NOT NULL
        AND issued_by_parent_id IS NOT NULL
        AND account_id IS NULL)
    )`,
  );

  // Validation reads a session by id on every authenticated request
  // (the cost ADR-0006 D2 accepts) -- that is the PK lookup.
  // Revocation reads by family or by parent, which is what these serve:
  // revokeParent must cut every live session for that parent, and a
  // family-wide action must be able to cut all of them.
  pgm.createIndex("sessions", ["family_id", "revoked_at"]);
  pgm.createIndex("sessions", "parent_id");
  pgm.createIndex("sessions", "child_id");
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable("sessions");
  pgm.dropTable("credentials");
  pgm.dropTable("accounts");
};
