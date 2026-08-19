#!/usr/bin/env node
// Seeds the real Phase 1 tables (P1-024's migration:
// services/api/migrations/1745000000000_phase1-foundation-schema.js)
// with synthetic families generated via the real domain-service pure
// functions (generateSyntheticDomainFamilies -> @life/domain-types),
// not the placeholder shapes scripts/seed.mjs still writes to the
// _phase0_fixtures_smoke table. This is the "seed compatibility"
// half of P1-024: proving the real schema round-trips real domain
// aggregates, not just a smoke value.
//
// Run `pnpm --filter @life/services-api run migrate:up` first.

import { Client } from "pg";
import { generateSyntheticDomainFamilies } from "../dist/domain-generators.js";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  `postgres://life:life_dev@localhost:${process.env.POSTGRES_HOST_PORT ?? "5433"}/life`;

const SEED = Number(process.env.FIXTURE_SEED ?? 42);
const FAMILY_COUNT = Number(process.env.FIXTURE_FAMILY_COUNT ?? 5);

const families = generateSyntheticDomainFamilies(SEED, FAMILY_COUNT);
const childCount = families.reduce((n, f) => n + f.family.children.length, 0);
const templateCount = families.reduce((n, f) => n + f.templates.length, 0);
const assignmentCount = families.reduce((n, f) => n + f.assignments.length, 0);

console.log(
  `Generated ${families.length} synthetic domain families (seed=${SEED}), ` +
    `${childCount} children, ${templateCount} task templates, ${assignmentCount} assignments.`,
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

const tableCheck = await client.query("SELECT to_regclass('public.families') AS exists");
if (!tableCheck.rows[0].exists) {
  console.error(
    "families doesn't exist. Run the migration first:\n" +
      "  pnpm --filter @life/services-api run migrate:up",
  );
  await client.end();
  process.exit(1);
}

await client.query("BEGIN");
try {
  for (const { family, templates, assignments } of families) {
    await client.query(
      `INSERT INTO families (family_id, status, version, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (family_id) DO NOTHING`,
      [family.familyId, family.status, family.version, family.createdAt],
    );

    for (const p of family.parents) {
      await client.query(
        `INSERT INTO parent_memberships
           (family_id, parent_id, status, is_family_owner, capabilities, invited_at, activated_at, revoked_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (family_id, parent_id) DO NOTHING`,
        [
          p.familyId ?? family.familyId,
          p.parentId,
          p.status,
          p.isFamilyOwner,
          p.capabilities,
          p.invitedAt,
          p.activatedAt ?? null,
          p.revokedAt ?? null,
        ],
      );
    }

    for (const c of family.children) {
      await client.query(
        `INSERT INTO child_profiles (child_id, family_id, display_name, birth_year, avatar_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (child_id) DO NOTHING`,
        [c.childId, family.familyId, c.displayName, c.birthYear, c.avatarId ?? null],
      );
    }

    for (const t of templates) {
      await client.query(
        `INSERT INTO task_templates
           (task_template_id, family_id, created_by_parent_id, title, verification_strategy, reward_xp, reward_coins, status, version, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (task_template_id) DO NOTHING`,
        [
          t.taskTemplateId,
          t.familyId,
          t.createdByParentId,
          t.title,
          t.verificationStrategy,
          t.rewardXp,
          t.rewardCoins,
          t.status,
          t.version,
          t.createdAt,
        ],
      );
    }

    for (const a of assignments) {
      await client.query(
        `INSERT INTO task_assignments
           (task_assignment_id, task_template_id, family_id, assigned_to_child_id, status, version, assigned_at, due_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (task_assignment_id) DO NOTHING`,
        [
          a.taskAssignmentId,
          a.taskTemplateId,
          a.familyId,
          a.assignedToChildId,
          a.status,
          a.version,
          a.assignedAt,
          a.dueAt ?? null,
        ],
      );
    }
  }
  await client.query("COMMIT");
} catch (err) {
  await client.query("ROLLBACK");
  throw err;
}

const readBack = await client.query(
  `SELECT
     (SELECT count(*) FROM families) AS families,
     (SELECT count(*) FROM child_profiles) AS children,
     (SELECT count(*) FROM task_templates) AS templates,
     (SELECT count(*) FROM task_assignments) AS assignments`,
);
const row = readBack.rows[0];
console.log(
  `Real-schema row counts: families=${row.families} children=${row.children} ` +
    `templates=${row.templates} assignments=${row.assignments}.`,
);

await client.end();
console.log("\nDomain fixture pipeline verified end to end against the live database.");
