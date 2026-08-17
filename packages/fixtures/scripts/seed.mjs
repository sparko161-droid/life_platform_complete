#!/usr/bin/env node
// Verifies the fixture pipeline against the real local Postgres from
// P0-002, not just in-memory generation. Writes to a clearly-labeled
// smoke table -- NOT the real Family/Task domain tables, which don't
// exist until Phase 1 migrations (P1-001) land on top of P0-009's
// contracts. This script's job is to prove "generate synthetic data ->
// connect -> write -> read back" works end to end today; it gets
// replaced by real domain inserts once those tables exist.
//
// Connection defaults match docker-compose.dev.yml's dev-only
// credentials (see docs/security/secrets-policy.md once P0-008 lands --
// these are intentionally public local defaults, never real secrets).
// Override with DATABASE_URL for a non-default local port.

import { Client } from "pg";
import { generateSyntheticFamilies } from "../dist/generators.js";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  `postgres://life:life_dev@localhost:${process.env.POSTGRES_HOST_PORT ?? "5433"}/life`;

const SEED = Number(process.env.FIXTURE_SEED ?? 42);
const FAMILY_COUNT = Number(process.env.FIXTURE_FAMILY_COUNT ?? 5);

const families = generateSyntheticFamilies(SEED, FAMILY_COUNT);
const childCount = families.reduce((n, f) => n + f.children.length, 0);
const taskCount = families.reduce((n, f) => n + f.tasks.length, 0);

console.log(
  `Generated ${families.length} synthetic families (seed=${SEED}), ` +
    `${childCount} children, ${taskCount} tasks.`,
);

const client = new Client({ connectionString: DATABASE_URL });

try {
  await client.connect();
} catch (err) {
  console.error(`Could not connect to ${DATABASE_URL.replace(/:[^:@]+@/, ":***@")}`);
  console.error(err instanceof Error ? err.message : err);
  console.error("\nIs the dev stack up? Try: pnpm dev:infra ; pnpm dev:infra:health");
  process.exit(1);
}

await client.query(`
  CREATE TABLE IF NOT EXISTS _phase0_fixtures_smoke (
    id SERIAL PRIMARY KEY,
    seed INTEGER NOT NULL,
    family_count INTEGER NOT NULL,
    child_count INTEGER NOT NULL,
    task_count INTEGER NOT NULL,
    seeded_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);

const insertResult = await client.query(
  `INSERT INTO _phase0_fixtures_smoke (seed, family_count, child_count, task_count)
   VALUES ($1, $2, $3, $4)
   RETURNING id, seeded_at`,
  [SEED, families.length, childCount, taskCount],
);

const row = insertResult.rows[0];
console.log(`Wrote smoke row id=${row.id} at ${row.seeded_at}.`);

const readBack = await client.query(
  "SELECT id, seed, family_count, child_count, task_count, seeded_at FROM _phase0_fixtures_smoke ORDER BY id DESC LIMIT 5",
);
console.log("Last 5 smoke rows:");
for (const r of readBack.rows) {
  console.log(`  #${r.id} seed=${r.seed} families=${r.family_count} children=${r.child_count} tasks=${r.task_count} at ${r.seeded_at.toISOString()}`);
}

await client.end();
console.log("\nFixture pipeline verified end to end against the live database.");
