/**
 * Phase 1 foundation schema (P1-024).
 *
 * One table per packages/domain-types persisted aggregate/entity, column
 * names snake_case (the repository layer, P1-025, maps to/from the
 * camelCase zod contracts -- this migration is the physical schema, not
 * the contract). Table creation order follows the real foreign-key
 * dependency graph so no forward references are needed within one file:
 *
 *   families -> parent_memberships / child_profiles / invitation_tokens
 *            -> task_templates -> task_assignments
 *            -> media_evidence -> task_completions / verification_results
 *            -> rewards -> reward_ledger_entries
 *
 * Enums are `text` + `CHECK`, not native Postgres `ENUM` types: adding a
 * new status value to a native enum needs `ALTER TYPE ... ADD VALUE`
 * (its own migration, non-transactional in older Postgres); a CHECK
 * constraint is a normal `ALTER TABLE` and stays a one-file diff against
 * the matching packages/domain-types `*_STATUSES`/`*_KINDS` array.
 *
 * `version` columns back the optimistic-concurrency contract
 * (docs/architecture/concurrency-and-conflicts.md); P1-025's repository
 * layer is expected to write via `UPDATE ... SET version = version + 1
 * WHERE id = $1 AND version = $2` and treat zero rows affected as a
 * conflict, with `checkVersion`/`check*Version`
 * (packages/domain-types/src/concurrency.ts) as the pre-check.
 *
 * `reward_ledger_entries.idempotency_key` carries a table-level UNIQUE
 * constraint -- the DB-level half of
 * docs/architecture/phase-1-scale-guardrails.md's SG-006/SG-007
 * ("explicit locking/unique-key ... semantics"; "retryable without
 * producing duplicate domain truth"), so a second write with the same
 * key fails at the database, not only at the application idempotency
 * check in packages/domain-types/src/idempotency.ts.
 *
 * Indexes target docs/architecture/phase-1-scale-guardrails.md's SG-002
 * ("indexes matching actual query predicates") for the query shapes the
 * frozen OpenAPI operations need: `/child/today` (assigned_to_child_id +
 * status), `/families/{id}/task-templates` (family_id + status),
 * `/children/{id}/reward-ledger` (child_id + kind + posted_at).
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  // -- families --------------------------------------------------------
  pgm.createTable("families", {
    family_id: { type: "uuid", primaryKey: true },
    status: {
      type: "text",
      notNull: true,
      check: "status IN ('PENDING_INVITE','ACTIVE','SUSPENDED','ARCHIVED')",
    },
    version: { type: "integer", notNull: true, default: 1 },
    created_at: { type: "timestamptz", notNull: true },
  });

  // -- parent_memberships (no dedicated id in the contract -- family_id + parent_id is the identity) --
  pgm.createTable("parent_memberships", {
    family_id: {
      type: "uuid",
      notNull: true,
      references: "families(family_id)",
    },
    parent_id: { type: "uuid", notNull: true },
    status: {
      type: "text",
      notNull: true,
      check: "status IN ('INVITED','ACTIVE','REVOKED')",
    },
    is_family_owner: { type: "boolean", notNull: true },
    capabilities: { type: "text[]", notNull: true, default: "{}" },
    invited_at: { type: "timestamptz", notNull: true },
    activated_at: { type: "timestamptz" },
    revoked_at: { type: "timestamptz" },
  });
  pgm.addConstraint("parent_memberships", "parent_memberships_pkey", {
    primaryKey: ["family_id", "parent_id"],
  });

  // -- child_profiles ---------------------------------------------------
  pgm.createTable("child_profiles", {
    child_id: { type: "uuid", primaryKey: true },
    family_id: {
      type: "uuid",
      notNull: true,
      references: "families(family_id)",
    },
    display_name: { type: "text", notNull: true },
    birth_year: { type: "integer", notNull: true },
    avatar_id: { type: "text" },
  });
  pgm.createIndex("child_profiles", "family_id");

  // -- invitation_tokens --------------------------------------------------
  pgm.createTable("invitation_tokens", {
    token_id: { type: "uuid", primaryKey: true },
    family_id: {
      type: "uuid",
      notNull: true,
      references: "families(family_id)",
    },
    invitee_id: { type: "uuid", notNull: true },
    capabilities: { type: "text[]", notNull: true, default: "{}" },
    status: {
      type: "text",
      notNull: true,
      check: "status IN ('PENDING','ACCEPTED','EXPIRED','REVOKED')",
    },
    created_at: { type: "timestamptz", notNull: true },
    expires_at: { type: "timestamptz", notNull: true },
    accepted_at: { type: "timestamptz" },
  });
  pgm.createIndex("invitation_tokens", "family_id");

  // -- task_templates -----------------------------------------------------
  pgm.createTable("task_templates", {
    task_template_id: { type: "uuid", primaryKey: true },
    family_id: {
      type: "uuid",
      notNull: true,
      references: "families(family_id)",
    },
    created_by_parent_id: { type: "uuid", notNull: true },
    title: { type: "text", notNull: true },
    verification_strategy: {
      type: "text",
      notNull: true,
      check:
        "verification_strategy IN ('MANUAL_SELF','PARENT_APPROVAL','PHOTO_PROOF','VIDEO_PROOF','CAMERA_EXERCISE','TIMER','COUNTER','AUDIO_PROOF','ALICE_SESSION','COMPOSITE')",
    },
    reward_xp: { type: "integer", notNull: true },
    reward_coins: { type: "integer", notNull: true },
    status: {
      type: "text",
      notNull: true,
      check: "status IN ('DRAFT','ACTIVE','ARCHIVED')",
    },
    version: { type: "integer", notNull: true, default: 1 },
    created_at: { type: "timestamptz", notNull: true },
  });
  // /families/{familyId}/task-templates lists a family's active templates.
  pgm.createIndex("task_templates", ["family_id", "status"]);

  // -- task_assignments -----------------------------------------------------
  pgm.createTable("task_assignments", {
    task_assignment_id: { type: "uuid", primaryKey: true },
    task_template_id: {
      type: "uuid",
      notNull: true,
      references: "task_templates(task_template_id)",
    },
    family_id: {
      type: "uuid",
      notNull: true,
      references: "families(family_id)",
    },
    assigned_to_child_id: { type: "uuid", notNull: true },
    status: {
      type: "text",
      notNull: true,
      check:
        "status IN ('ASSIGNED','IN_PROGRESS','SUBMITTED','VERIFYING','APPROVED','REJECTED','COMPLETED','ARCHIVED')",
    },
    version: { type: "integer", notNull: true, default: 1 },
    assigned_at: { type: "timestamptz", notNull: true },
    due_at: { type: "timestamptz" },
  });
  // /child/today's critical query: this child's non-terminal assignments.
  pgm.createIndex("task_assignments", ["assigned_to_child_id", "status"]);
  pgm.createIndex("task_assignments", "family_id");

  // -- media_evidence -----------------------------------------------------
  pgm.createTable("media_evidence", {
    media_evidence_id: { type: "uuid", primaryKey: true },
    family_id: {
      type: "uuid",
      notNull: true,
      references: "families(family_id)",
    },
    child_id: { type: "uuid", notNull: true },
    kind: {
      type: "text",
      notNull: true,
      check: "kind IN ('PHOTO','VIDEO','AUDIO')",
    },
    // Opaque object-storage key -- never a public URL, per
    // docs/architecture/data-architecture.md ("Media"). No bytes/blob
    // column exists here on purpose (SG-004,
    // docs/architecture/phase-1-scale-guardrails.md).
    storage_key: { type: "text", notNull: true },
    content_type: { type: "text", notNull: true },
    size_bytes: { type: "integer", notNull: true },
    uploaded_at: { type: "timestamptz", notNull: true },
    retention_expires_at: { type: "timestamptz" },
  });
  pgm.createIndex("media_evidence", "family_id");

  // -- task_completions -----------------------------------------------------
  pgm.createTable("task_completions", {
    task_completion_id: { type: "uuid", primaryKey: true },
    task_assignment_id: {
      type: "uuid",
      notNull: true,
      references: "task_assignments(task_assignment_id)",
    },
    child_id: { type: "uuid", notNull: true },
    submitted_at: { type: "timestamptz", notNull: true },
    media_evidence_id: {
      type: "uuid",
      references: "media_evidence(media_evidence_id)",
    },
    counter_value: { type: "integer" },
    timer_seconds: { type: "integer" },
    self_report_note: { type: "text" },
  });
  pgm.createIndex("task_completions", "task_assignment_id");

  // -- verification_results ------------------------------------------------
  // No dedicated id in the contract (verification.ts); an assignment can
  // be verified more than once across a REJECTED -> IN_PROGRESS retry
  // cycle, so (task_assignment_id, verified_at) is the natural key for
  // this append-only record, not a single-column PK.
  pgm.createTable("verification_results", {
    task_assignment_id: {
      type: "uuid",
      notNull: true,
      references: "task_assignments(task_assignment_id)",
    },
    child_id: { type: "uuid", notNull: true },
    strategy: {
      type: "text",
      notNull: true,
      check:
        "strategy IN ('MANUAL_SELF','PARENT_APPROVAL','PHOTO_PROOF','VIDEO_PROOF','CAMERA_EXERCISE','TIMER','COUNTER','AUDIO_PROOF','ALICE_SESSION','COMPOSITE')",
    },
    outcome: {
      type: "text",
      notNull: true,
      check: "outcome IN ('PASSED','FAILED','PENDING_REVIEW')",
    },
    media_evidence_id: {
      type: "uuid",
      references: "media_evidence(media_evidence_id)",
    },
    verified_at: { type: "timestamptz", notNull: true },
    reviewed_by_parent_id: { type: "uuid" },
    notes: { type: "text" },
  });
  pgm.addConstraint("verification_results", "verification_results_pkey", {
    primaryKey: ["task_assignment_id", "verified_at"],
  });

  // -- rewards (catalog entity, distinct from reward_ledger_entries below) --
  pgm.createTable("rewards", {
    reward_id: { type: "uuid", primaryKey: true },
    family_id: {
      type: "uuid",
      notNull: true,
      references: "families(family_id)",
    },
    created_by_parent_id: { type: "uuid", notNull: true },
    title: { type: "text", notNull: true },
    type: {
      type: "text",
      notNull: true,
      check:
        "type IN ('XP','COINS','MONEY','SCREEN_TIME','DEVICE_TIME','COUPON','ACTIVITY','FAMILY','CUSTOM')",
    },
    status: {
      type: "text",
      notNull: true,
      check: "status IN ('LOCKED','AVAILABLE','REDEEMING','REDEEMED','EXPIRED','CANCELLED')",
    },
    version: { type: "integer", notNull: true, default: 1 },
    budget_limit_per_period: { type: "integer" },
    is_one_use: { type: "boolean", notNull: true, default: false },
    created_at: { type: "timestamptz", notNull: true },
  });
  pgm.createIndex("rewards", "family_id");

  // -- reward_ledger_entries (append-only; no balance column anywhere -- ---
  // docs/architecture/data-architecture.md: "Never store mutable balance
  // as sole truth." Balance is always computeBalance() over this table.)
  pgm.createTable("reward_ledger_entries", {
    reward_ledger_entry_id: { type: "uuid", primaryKey: true },
    family_id: {
      type: "uuid",
      notNull: true,
      references: "families(family_id)",
    },
    child_id: { type: "uuid", notNull: true },
    kind: {
      type: "text",
      notNull: true,
      check: "kind IN ('XP','COINS','MONEY')",
    },
    // Signed: positive for grants, negative for redemptions/deductions.
    amount: { type: "integer", notNull: true },
    reason: {
      type: "text",
      notNull: true,
      check: "reason IN ('TASK_COMPLETION','PARENT_ADJUSTMENT','REWARD_REDEMPTION','STREAK_BONUS')",
    },
    source_task_assignment_id: {
      type: "uuid",
      references: "task_assignments(task_assignment_id)",
    },
    source_reward_id: { type: "uuid", references: "rewards(reward_id)" },
    adjusted_by_parent_id: { type: "uuid" },
    idempotency_key: { type: "text", notNull: true },
    posted_at: { type: "timestamptz", notNull: true },
  });
  // Exactly-once at the database, not just the application idempotency
  // check (SG-006/SG-007).
  pgm.addConstraint(
    "reward_ledger_entries",
    "reward_ledger_entries_idempotency_key_unique",
    "UNIQUE(idempotency_key)",
  );
  // computeBalance()'s query shape: this child's entries of one kind,
  // ordered by time, without scanning every child's ledger (SG-005).
  pgm.createIndex("reward_ledger_entries", ["child_id", "kind", "posted_at"]);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  // Reverse dependency order.
  pgm.dropTable("reward_ledger_entries");
  pgm.dropTable("rewards");
  pgm.dropTable("verification_results");
  pgm.dropTable("task_completions");
  pgm.dropTable("media_evidence");
  pgm.dropTable("task_assignments");
  pgm.dropTable("task_templates");
  pgm.dropTable("invitation_tokens");
  pgm.dropTable("child_profiles");
  pgm.dropTable("parent_memberships");
  pgm.dropTable("families");
};
