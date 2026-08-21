/**
 * Task-builder draft validation (P1-003).
 *
 * Kept out of the component on purpose. docs/ux/screens/parent-task-builder.md
 * lists validation as its own step of the flow, and a rule that only
 * exists inside JSX can only be checked by rendering -- which is how
 * "the error message changed" and "the rule changed" become
 * indistinguishable.
 *
 * None of this replaces the server's own checks. Client gating is UX
 * only (docs/security/permissions.md); the API refuses the same things
 * again for a caller that never opens this screen.
 */

export interface Child {
  childId: string;
  displayName: string;
  birthYear: number;
}

export interface Draft {
  title: string;
  strategy: string;
  rewardXp: string;
  rewardCoins: string;
  childId: string;
  dueAt: string;
}

export interface DraftProblems {
  /** Blocking. The task cannot be created while any of these stand. */
  errors: string[];
  /** Non-blocking. Worth saying before the task exists, not a refusal. */
  warnings: string[];
}

/** Matches TaskTemplateSchema.title in @life/domain-types. */
const MAX_TITLE_LENGTH = 120;

/**
 * Below this, a camera-based proof usually costs the child more effort
 * than the task itself. A warning rather than a rule: the parent knows
 * their own child, and the product range starts at 4 (HD-P1-034-1).
 */
const PHOTO_PROOF_COMFORTABLE_AGE = 7;

export function validateDraft(draft: Draft, children: Child[], now: Date = new Date()): DraftProblems {
  const errors: string[] = [];
  const warnings: string[] = [];

  const title = draft.title.trim();
  if (!title) errors.push("Введите название задания.");
  else if (title.length > MAX_TITLE_LENGTH) errors.push("Название длиннее 120 символов.");

  if (!draft.childId) errors.push("Выберите, кому назначить задание.");
  else if (!children.some((c) => c.childId === draft.childId)) {
    // The selected child left the family, or the list is stale. Silently
    // sending it would produce a server error the parent cannot read.
    errors.push("Выбранный ребёнок больше недоступен. Обновите страницу.");
  }

  const xp = Number(draft.rewardXp);
  const coins = Number(draft.rewardCoins);
  if (!Number.isInteger(xp) || xp < 0) errors.push("Опыт должен быть целым числом от нуля.");
  if (!Number.isInteger(coins) || coins < 0) errors.push("Монеты должны быть целым числом от нуля.");

  if (draft.dueAt && new Date(draft.dueAt).getTime() < now.getTime()) {
    // An assignment that is overdue the moment it appears reads to a
    // child as a failure they were never given a chance to avoid.
    errors.push("Срок уже прошёл.");
  }

  if (Number.isInteger(xp) && Number.isInteger(coins) && xp === 0 && coins === 0) {
    warnings.push("За это задание не будет награды.");
  }

  const child = children.find((c) => c.childId === draft.childId);
  if (draft.strategy === "PHOTO_PROOF" && child && now.getFullYear() - child.birthYear < PHOTO_PROOF_COMFORTABLE_AGE) {
    warnings.push("Для младшего ребёнка фото-подтверждение часто сложнее самого задания.");
  }

  return { errors, warnings };
}
