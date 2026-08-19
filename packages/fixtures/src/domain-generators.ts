/**
 * Synthetic fixtures shaped as real @life/domain-types aggregates
 * (P1-024's "seed compatibility" scope).
 *
 * generators.ts's `SyntheticFamily` shapes predate P0-009's contract pack
 * (its own header says so) and were never meant to be inserted into real
 * tables -- this module is the replacement generation path that produces
 * actual `Family`/`TaskTemplate`/`TaskAssignment` values by calling the
 * real pure domain-service functions (createFamily, addChild,
 * createTemplate, publishTemplate, assignTask), the same way application
 * code will. `scripts/seed-domain.mjs` inserts what this produces into
 * the tables P1-024's migration creates.
 *
 * Deterministic: the same seed always produces the same aggregates (ids
 * included, via `seededUuid`), per docs/engineering/local-environment.md
 * ("Seed scripts must be deterministic").
 */
import {
  addChild,
  assignTask,
  createFamily,
  createTemplate,
  publishTemplate,
} from "@life/domain-types";
import type { ChildId, Family, FamilyId, ParentId, TaskAssignment, TaskTemplate, TaskTemplateId } from "@life/domain-types";
import { intBetween, mulberry32, pick, seededUuid } from "./rng.js";

const CHILD_NAMES = ["Аня", "Ваня", "Настя", "Тимур", "Соня", "Лёша", "Мила", "Егор"] as const;
const TASK_TITLES = [
  "Убрать в комнате",
  "Сделать 20 приседаний",
  "Прочитать 10 страниц",
  "Полить цветы",
  "Собрать рюкзак",
  "Почистить зубы утром",
] as const;
const VERIFICATION_STRATEGIES = ["MANUAL_SELF", "PARENT_APPROVAL", "TIMER", "COUNTER"] as const;

/** Fixed, not real-"now" -- fixtures need reproducibility, not freshness. */
const SEED_NOW = "2026-01-01T00:00:00.000Z";

export interface SyntheticDomainFamily {
  family: Family;
  templates: TaskTemplate[];
  assignments: TaskAssignment[];
}

function makeFamily(rng: () => number): SyntheticDomainFamily {
  const familyId = seededUuid(rng) as FamilyId;
  const ownerId = seededUuid(rng) as ParentId;

  const created = createFamily({ familyId, ownerId, now: SEED_NOW });
  let family = created.next;

  const childCount = intBetween(rng, 1, 3);
  const childIds: ChildId[] = [];
  for (let i = 0; i < childCount; i++) {
    const childId = seededUuid(rng) as ChildId;
    childIds.push(childId);
    const added = addChild(family, {
      childId,
      displayName: pick(rng, CHILD_NAMES),
      birthYear: 2026 - intBetween(rng, 5, 15),
      actorId: ownerId,
      now: SEED_NOW,
    });
    family = added.next;
  }

  const templates: TaskTemplate[] = [];
  const assignments: TaskAssignment[] = [];
  for (const childId of childIds) {
    const templateCount = intBetween(rng, 1, 3);
    for (let i = 0; i < templateCount; i++) {
      const taskTemplateId = seededUuid(rng) as TaskTemplateId;
      const created = createTemplate({
        taskTemplateId,
        familyId,
        createdByParentId: ownerId,
        title: pick(rng, TASK_TITLES),
        verificationStrategy: pick(rng, VERIFICATION_STRATEGIES),
        rewardXp: intBetween(rng, 5, 50),
        rewardCoins: intBetween(rng, 1, 20),
        now: SEED_NOW,
      });
      const published = publishTemplate(created.next, { actorId: ownerId, now: SEED_NOW });
      templates.push(published.next);

      const assigned = assignTask(published.next, {
        taskAssignmentId: seededUuid(rng) as any,
        assignedToChildId: childId,
        actorId: ownerId,
        now: SEED_NOW,
      });
      assignments.push(assigned.next);
    }
  }

  return { family, templates, assignments };
}

/** @public */
export function generateSyntheticDomainFamilies(seed: number, count: number): SyntheticDomainFamily[] {
  const rng = mulberry32(seed);
  return Array.from({ length: count }, () => makeFamily(rng));
}
