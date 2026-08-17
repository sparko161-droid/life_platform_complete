/**
 * First real migration (P0-checklist: "PostgreSQL migration tooling
 * selected"). Deliberately not a domain table -- Phase 1 hasn't defined
 * one yet (see packages/domain-types for the frozen contracts, not yet
 * implemented as persistence). This migrates the _phase0_fixtures_smoke
 * table that packages/fixtures/scripts/seed.mjs previously created
 * itself with an ad-hoc `CREATE TABLE IF NOT EXISTS` -- that script now
 * assumes migrations have already run, proving the pipeline end to end
 * against a real consumer instead of a throwaway example.
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.createTable("_phase0_fixtures_smoke", {
    id: "id",
    seed: { type: "integer", notNull: true },
    family_count: { type: "integer", notNull: true },
    child_count: { type: "integer", notNull: true },
    task_count: { type: "integer", notNull: true },
    seeded_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable("_phase0_fixtures_smoke");
};
