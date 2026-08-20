/**
 * Child device pairing codes (P1-036), closing DISC-P1-032-1.
 *
 * A parent can provision a child session, but the resulting session id
 * had no safe way to reach the child's device. This table holds the
 * artefact that bridges that gap.
 *
 * The design constraint, from DISC-P1-032-1's own security note: the
 * thing the parent reads out **must not be the session id**. A session id
 * is a bearer credential; putting one on screen to be typed or
 * photographed defeats the httpOnly posture the whole web tier is built
 * around. So this is a separate, short-lived, single-use artefact that is
 * *exchanged for* a session and then dead.
 *
 * Three properties, and each is enforced by the schema rather than left
 * to the application to remember:
 *
 *   - **Single use.** `redeemed_at` is set on the one redemption that
 *     wins; a partial unique index makes a second unredeemed row for the
 *     same code impossible.
 *   - **Short-lived.** `expires_at` is required, and redemption checks
 *     it. The parent is standing next to the child, so minutes is
 *     generous.
 *   - **Never the session.** `code_hash` stores a hash, not the code, so
 *     a database read cannot replay a pairing -- the same reasoning as
 *     credentials, applied to a credential that happens to be short-lived.
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.createTable("child_pairing_codes", {
    pairing_id: { type: "uuid", primaryKey: true },
    // Hashed, never the plaintext code. A short code is low-entropy by
    // design (a parent has to read it aloud), so the mitigation is the
    // narrow window and single use, not the hash alone -- but storing it
    // in the clear would let anyone with read access pair a device.
    code_hash: { type: "text", notNull: true },
    family_id: { type: "uuid", notNull: true, references: "families(family_id)" },
    child_id: { type: "uuid", notNull: true },
    issued_by_parent_id: { type: "uuid", notNull: true },
    issued_at: { type: "timestamptz", notNull: true },
    expires_at: { type: "timestamptz", notNull: true },
    redeemed_at: { type: "timestamptz" },
    // The session this code produced, once it has been redeemed. Kept so
    // a support question ("which device did we pair?") is answerable
    // without guessing.
    redeemed_session_id: { type: "uuid", references: "sessions(session_id)" },
  });

  // Redemption looks a code up by its hash. Only *unredeemed* codes are
  // unique: a redeemed row stays for audit, and two historical rows could
  // legitimately share a hash once both are spent.
  pgm.createIndex("child_pairing_codes", "code_hash", {
    unique: true,
    where: "redeemed_at IS NULL",
    name: "child_pairing_codes_active_code_unique",
  });

  // "Show me this child's outstanding codes" -- used when re-issuing, so
  // an earlier unredeemed code can be invalidated rather than left live.
  pgm.createIndex("child_pairing_codes", ["child_id", "redeemed_at"]);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable("child_pairing_codes");
};
