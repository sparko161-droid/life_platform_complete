import { intBetween, mulberry32, pick } from "./rng.js";
import type { SyntheticChild, SyntheticFamily, SyntheticTask, VerificationStrategy } from "./types.js";

// Clearly-fictional given names for synthetic fixtures only -- not sourced
// from or resembling any real family's data, per docs/security/privacy.md
// ("synthetic family accounts only") and
// docs/engineering/local-environment.md ("Use synthetic family/child
// accounts only").
const CHILD_NAMES = ["Аня", "Ваня", "Настя", "Тимур", "Соня", "Лёша", "Мила", "Егор"] as const;
const FAMILY_SURNAMES = ["Тестова", "Пробная", "Демо", "Синтетик", "Образцова"] as const;
const TASK_TITLES = [
  "Убрать в комнате",
  "Сделать 20 приседаний",
  "Прочитать 10 страниц",
  "Полить цветы",
  "Собрать рюкзак",
  "Почистить зубы утром",
] as const;
const VERIFICATIONS: readonly VerificationStrategy[] = [
  "MANUAL_SELF",
  "PARENT_APPROVAL",
  "PHOTO_PROOF",
  "CAMERA_EXERCISE",
  "TIMER",
  "COUNTER",
];

function makeChild(rng: () => number, familyId: string, index: number): SyntheticChild {
  return {
    id: `${familyId}-child-${index}`,
    displayName: pick(rng, CHILD_NAMES),
    age: intBetween(rng, 5, 15),
  };
}

function makeTask(rng: () => number, familyId: string, index: number, child: SyntheticChild): SyntheticTask {
  return {
    id: `${familyId}-task-${index}`,
    title: pick(rng, TASK_TITLES),
    verification: pick(rng, VERIFICATIONS),
    assignedToChildId: child.id,
  };
}

function makeFamily(rng: () => number, index: number): SyntheticFamily {
  const id = `family-${index}`;
  const children = Array.from({ length: intBetween(rng, 1, 3) }, (_, i) => makeChild(rng, id, i + 1));
  const tasks = children.flatMap((child, ci) =>
    Array.from({ length: intBetween(rng, 1, 4) }, (_, ti) => makeTask(rng, id, ci * 10 + ti + 1, child)),
  );
  return {
    id,
    name: `${pick(rng, FAMILY_SURNAMES)} семья ${index}`,
    children,
    tasks,
  };
}

/**
 * Deterministic: the same seed always produces the same families, per
 * docs/engineering/local-environment.md ("Seed scripts must be
 * deterministic").
 */
export function generateSyntheticFamilies(seed: number, count: number): SyntheticFamily[] {
  const rng = mulberry32(seed);
  return Array.from({ length: count }, (_, i) => makeFamily(rng, i + 1));
}
