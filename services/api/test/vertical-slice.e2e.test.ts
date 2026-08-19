/**
 * Vertical-slice end-to-end against the real stack (P1-027).
 *
 * Acceptance criterion (tasks/registry.yaml): "The full
 * parent-creates-task -> child-completes -> proof -> approval ->
 * reward-ledger journey runs against real Postgres end to end with no
 * manual DB intervention."
 *
 * What makes this distinct from http.e2e.test.ts (P1-026/P1-028), which
 * already walks the happy path over HTTP:
 *
 *   1. **Every step asserts the real database row, not only the API
 *      response.** An API that returns a correct-looking body while
 *      persisting nothing would pass a response-only test; that is
 *      exactly the failure mode "runs against real Postgres" exists to
 *      rule out. Reads go through a raw pool query, deliberately
 *      bypassing the repository layer so a repository bug cannot mask
 *      itself.
 *   2. **No manual DB intervention** is an assertion, not a claim: this
 *      file never INSERTs or UPDATEs. Its only direct SQL is SELECT.
 *   3. **Fixture-driven inputs** (packages/fixtures' deterministic
 *      synthetic families) rather than ad-hoc literals, per the task's
 *      test strategy.
 *   4. Covers the **rejection** branch and its invariant -- "Rejected
 *      proof never grants the task reward"
 *      (docs/architecture/vertical-slice/task-to-reward.md) -- which the
 *      happy-path suite does not exercise at all.
 *
 * Skips cleanly when DATABASE_URL is unreachable, same as the sibling
 * suites; CI runs it against a real postgres service.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import "reflect-metadata";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { generateSyntheticDomainFamilies } from "@life/fixtures";
import { computeBalance } from "@life/domain-types";
import type { RewardLedgerEntry } from "@life/domain-types";
import { AppModule } from "../src/app.module.js";
import { signSessionToken } from "../src/auth/session.js";
import { closePool, getPool } from "../src/db/pool.js";
import { rowToRewardLedgerEntry } from "../src/db/rows.js";

let dbAvailable = false;
let app: INestApplication | undefined;

before(async () => {
  process.env.SESSION_JWT_SECRET ??= "test-only-secret-not-a-real-credential";
  try {
    await getPool().query("SELECT 1");
    const check = await getPool().query("SELECT to_regclass('public.families') AS exists");
    dbAvailable = Boolean(check.rows[0]?.exists);
  } catch {
    dbAvailable = false;
  }
  if (!dbAvailable) {
    console.log("\n[vertical-slice.e2e.test.ts] DATABASE_URL unreachable or unmigrated. Skipping -- needs a real Postgres.");
    return;
  }
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
});

after(async () => {
  if (app) await app.close();
  await closePool();
});

function skipIfNoDb(t: { skip: (reason?: string) => void }): boolean {
  if (!dbAvailable || !app) {
    t.skip("DATABASE_URL unreachable in this environment");
    return true;
  }
  return false;
}

/** Read-only. This suite must never write to the DB directly. */
async function selectRows<T = Record<string, unknown>>(sql: string, params: unknown[]): Promise<T[]> {
  assert.match(sql.trimStart().slice(0, 6).toUpperCase(), /^SELECT/, "this suite may only SELECT -- no manual DB intervention");
  const { rows } = await getPool().query(sql, params);
  return rows as T[];
}

async function selectOne<T = Record<string, unknown>>(sql: string, params: unknown[]): Promise<T> {
  const rows = await selectRows<T>(sql, params);
  assert.equal(rows.length, 1, `expected exactly one row for: ${sql}`);
  return rows[0]!;
}

// Deterministic synthetic inputs (packages/fixtures). Ids are NOT taken
// from the fixture -- the API mints those; only the human-facing values
// are reused, so the journey is driven end to end by real HTTP calls.
const [fixture] = generateSyntheticDomainFamilies(2027, 1);
const fixtureChild = fixture!.family.children[0]!;
const fixtureTemplate = fixture!.templates[0]!;

test("full journey: parent creates task -> child completes with proof -> parent approves -> reward ledger, all via HTTP against real Postgres", async (t) => {
  if (skipIfNoDb(t)) return;
  const server = app!.getHttpServer();
  const parentId = randomUUID();
  const parentToken = signSessionToken({ actorId: parentId, role: "parent" });
  const asParent = (req: request.Test) => req.set("Authorization", `Bearer ${parentToken}`);

  // --- 1. Parent registers the family -------------------------------
  const familyRes = await asParent(request(server).post("/api/v1/families")).send({ ownerParentId: parentId });
  assert.equal(familyRes.status, 201);
  const familyId: string = familyRes.body.familyId;

  const familyRow = await selectOne<{ status: string; version: number }>(
    "SELECT status, version FROM families WHERE family_id = $1",
    [familyId],
  );
  assert.equal(familyRow.status, "ACTIVE", "family must be persisted, not just returned");
  const ownerRow = await selectOne<{ status: string; is_family_owner: boolean }>(
    "SELECT status, is_family_owner FROM parent_memberships WHERE family_id = $1 AND parent_id = $2",
    [familyId, parentId],
  );
  assert.equal(ownerRow.status, "ACTIVE");
  assert.equal(ownerRow.is_family_owner, true);

  // --- 2. Parent adds the child -------------------------------------
  const childRes = await asParent(request(server).post(`/api/v1/families/${familyId}/children`)).send({
    displayName: fixtureChild.displayName,
    birthYear: fixtureChild.birthYear,
  });
  assert.equal(childRes.status, 201);
  const childId: string = childRes.body.childId;

  const childRow = await selectOne<{ display_name: string; birth_year: number; family_id: string }>(
    "SELECT display_name, birth_year, family_id FROM child_profiles WHERE child_id = $1",
    [childId],
  );
  assert.equal(childRow.display_name, fixtureChild.displayName);
  assert.equal(childRow.birth_year, fixtureChild.birthYear);
  assert.equal(childRow.family_id, familyId);

  // --- 3. Parent creates the task template (DRAFT) ------------------
  const templateRes = await asParent(request(server).post(`/api/v1/families/${familyId}/task-templates`)).send({
    title: fixtureTemplate.title,
    verificationStrategy: "PARENT_APPROVAL",
    rewardXp: fixtureTemplate.rewardXp,
    rewardCoins: fixtureTemplate.rewardCoins,
  });
  assert.equal(templateRes.status, 201);
  const templateId: string = templateRes.body.taskTemplateId;

  const draftRow = await selectOne<{ status: string; title: string; reward_xp: number; reward_coins: number }>(
    "SELECT status, title, reward_xp, reward_coins FROM task_templates WHERE task_template_id = $1",
    [templateId],
  );
  assert.equal(draftRow.status, "DRAFT", "a new template must persist as DRAFT, not silently active");
  assert.equal(draftRow.title, fixtureTemplate.title);
  assert.equal(draftRow.reward_xp, fixtureTemplate.rewardXp);

  // --- 4. Parent publishes it (DRAFT -> ACTIVE) ---------------------
  const publishRes = await asParent(request(server).post(`/api/v1/task-templates/${templateId}/publish`)).set(
    "Idempotency-Key",
    `p1027-publish-${templateId}`,
  );
  assert.equal(publishRes.status, 200);
  const activeRow = await selectOne<{ status: string; version: number }>(
    "SELECT status, version FROM task_templates WHERE task_template_id = $1",
    [templateId],
  );
  assert.equal(activeRow.status, "ACTIVE");
  assert.ok(activeRow.version > 1, "publishing must bump the optimistic-concurrency version in the DB");

  // --- 5. Parent assigns it to the child ----------------------------
  const assignRes = await asParent(request(server).post(`/api/v1/task-templates/${templateId}/assignments`)).send({
    assignedToChildId: childId,
  });
  assert.equal(assignRes.status, 201);
  const assignmentId: string = assignRes.body.taskAssignmentId;

  const assignedRow = await selectOne<{ status: string; assigned_to_child_id: string; family_id: string }>(
    "SELECT status, assigned_to_child_id, family_id FROM task_assignments WHERE task_assignment_id = $1",
    [assignmentId],
  );
  assert.equal(assignedRow.status, "ASSIGNED");
  assert.equal(assignedRow.assigned_to_child_id, childId);
  assert.equal(assignedRow.family_id, familyId);

  // --- 6. The child starts it (a real child session, not the parent's)
  const childToken = signSessionToken({ actorId: childId, role: "child", familyId });
  const asChild = (req: request.Test) => req.set("Authorization", `Bearer ${childToken}`);

  const startRes = await asChild(request(server).post(`/api/v1/task-assignments/${assignmentId}/start`)).set(
    "Idempotency-Key",
    `p1027-start-${assignmentId}`,
  );
  assert.equal(startRes.status, 200);
  assert.equal(
    (await selectOne<{ status: string }>("SELECT status FROM task_assignments WHERE task_assignment_id = $1", [assignmentId])).status,
    "IN_PROGRESS",
  );

  // --- 7. The child submits proof -----------------------------------
  // openapi.yaml: "SubmitProof is the existing submitTaskCompletion --
  // TaskCompletion already carries exactly what 'proof' means
  // (media/counter/timer/note)."
  const proofNote = "Убрано, всё на местах";
  const submitRes = await asChild(request(server).post(`/api/v1/task-assignments/${assignmentId}/completions`))
    .set("Idempotency-Key", `p1027-submit-${assignmentId}`)
    .send({ selfReportNote: proofNote });
  assert.equal(submitRes.status, 201);

  const completionRow = await selectOne<{ child_id: string; self_report_note: string }>(
    "SELECT child_id, self_report_note FROM task_completions WHERE task_assignment_id = $1",
    [assignmentId],
  );
  assert.equal(completionRow.child_id, childId, "the proof record must be attributed to the submitting child");
  assert.equal(completionRow.self_report_note, proofNote, "the proof itself must be persisted, not discarded");
  assert.equal(
    (await selectOne<{ status: string }>("SELECT status FROM task_assignments WHERE task_assignment_id = $1", [assignmentId])).status,
    "SUBMITTED",
  );

  // --- 8. The parent approves ---------------------------------------
  const approveRes = await asParent(request(server).post(`/api/v1/task-assignments/${assignmentId}/approve`)).set(
    "Idempotency-Key",
    `p1027-approve-${assignmentId}`,
  );
  assert.equal(approveRes.status, 200);
  assert.equal(
    (await selectOne<{ status: string }>("SELECT status FROM task_assignments WHERE task_assignment_id = $1", [assignmentId])).status,
    "COMPLETED",
  );

  // --- 9. The reward ledger, read straight from the database --------
  const ledgerRows = await selectRows(
    "SELECT reward_ledger_entry_id, family_id, child_id, kind, amount, reason, source_task_assignment_id, source_reward_id, adjusted_by_parent_id, idempotency_key, posted_at FROM reward_ledger_entries WHERE source_task_assignment_id = $1 ORDER BY kind",
    [assignmentId],
  );
  const entries: RewardLedgerEntry[] = ledgerRows.map((r) => rowToRewardLedgerEntry(r as never));
  assert.equal(entries.length, 2, "approval must post exactly one XP and one COINS entry");
  assert.deepEqual(
    entries.map((e) => e.kind),
    ["COINS", "XP"],
  );
  for (const e of entries) {
    assert.equal(e.reason, "TASK_COMPLETION");
    assert.equal(e.childId, childId);
    assert.equal(e.familyId, familyId);
    assert.ok(e.idempotencyKey.includes(assignmentId), "each entry's idempotency key must trace back to its source assignment");
  }
  // Balance is derived from the append-only ledger, never stored
  // (docs/architecture/data-architecture.md).
  assert.equal(computeBalance(entries, "XP"), fixtureTemplate.rewardXp);
  assert.equal(computeBalance(entries, "COINS"), fixtureTemplate.rewardCoins);

  // --- 10. Exactly-once: replaying approval changes nothing ---------
  const replay = await asParent(request(server).post(`/api/v1/task-assignments/${assignmentId}/approve`)).set(
    "Idempotency-Key",
    `p1027-approve-${assignmentId}`,
  );
  assert.equal(replay.status, 200);
  const afterReplay = await selectRows("SELECT reward_ledger_entry_id FROM reward_ledger_entries WHERE source_task_assignment_id = $1", [
    assignmentId,
  ]);
  assert.equal(afterReplay.length, 2, "a replayed approval must not post a second reward");

  // --- 11. The child's own view reflects it -------------------------
  const todayRes = await asChild(request(server).get(`/api/v1/child/today?childId=${childId}`));
  assert.equal(todayRes.status, 200);
  assert.equal(todayRes.body.assignments.length, 1);
  assert.equal(todayRes.body.assignments[0].status, "COMPLETED");
});

test("rejection branch: rejected proof never grants the task reward", async (t) => {
  if (skipIfNoDb(t)) return;
  const server = app!.getHttpServer();
  const parentId = randomUUID();
  const parentToken = signSessionToken({ actorId: parentId, role: "parent" });
  const asParent = (req: request.Test) => req.set("Authorization", `Bearer ${parentToken}`);

  const familyId: string = (await asParent(request(server).post("/api/v1/families")).send({ ownerParentId: parentId })).body.familyId;
  const childId: string = (
    await asParent(request(server).post(`/api/v1/families/${familyId}/children`)).send({
      displayName: fixtureChild.displayName,
      birthYear: fixtureChild.birthYear,
    })
  ).body.childId;
  const templateId: string = (
    await asParent(request(server).post(`/api/v1/families/${familyId}/task-templates`)).send({
      title: fixtureTemplate.title,
      verificationStrategy: "PARENT_APPROVAL",
      rewardXp: fixtureTemplate.rewardXp,
      rewardCoins: fixtureTemplate.rewardCoins,
    })
  ).body.taskTemplateId;
  await asParent(request(server).post(`/api/v1/task-templates/${templateId}/publish`)).set("Idempotency-Key", `rej-pub-${templateId}`);
  const assignmentId: string = (
    await asParent(request(server).post(`/api/v1/task-templates/${templateId}/assignments`)).send({ assignedToChildId: childId })
  ).body.taskAssignmentId;

  const childToken = signSessionToken({ actorId: childId, role: "child", familyId });
  const asChild = (req: request.Test) => req.set("Authorization", `Bearer ${childToken}`);
  await asChild(request(server).post(`/api/v1/task-assignments/${assignmentId}/start`)).set("Idempotency-Key", `rej-start-${assignmentId}`);
  await asChild(request(server).post(`/api/v1/task-assignments/${assignmentId}/completions`))
    .set("Idempotency-Key", `rej-submit-${assignmentId}`)
    .send({ selfReportNote: "Наверное готово" });

  const rejectRes = await asParent(request(server).post(`/api/v1/task-assignments/${assignmentId}/reject`))
    .set("Idempotency-Key", `rej-reject-${assignmentId}`)
    .send({ comment: "Ещё осталось на столе — попробуй ещё раз" });
  assert.equal(rejectRes.status, 200);

  assert.equal(
    (await selectOne<{ status: string }>("SELECT status FROM task_assignments WHERE task_assignment_id = $1", [assignmentId])).status,
    "REJECTED",
  );
  // task-to-reward.md's invariant, asserted against the real ledger.
  const ledger = await selectRows("SELECT reward_ledger_entry_id FROM reward_ledger_entries WHERE source_task_assignment_id = $1", [
    assignmentId,
  ]);
  assert.equal(ledger.length, 0, "a rejected proof must never post a reward ledger entry");

  // The child can retry: REJECTED -> IN_PROGRESS is a real transition.
  const retry = await asChild(request(server).post(`/api/v1/task-assignments/${assignmentId}/start`)).set(
    "Idempotency-Key",
    `rej-retry-${assignmentId}`,
  );
  assert.equal(retry.status, 200);
  assert.equal(
    (await selectOne<{ status: string }>("SELECT status FROM task_assignments WHERE task_assignment_id = $1", [assignmentId])).status,
    "IN_PROGRESS",
    "a child must be able to retry after a rejection",
  );
});
