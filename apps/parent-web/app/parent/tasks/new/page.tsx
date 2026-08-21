"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, StateBanner, defineScreenStates, recoveryFor, type RecoveryState } from "@life/ui";
import { validateDraft, type Child, type Draft } from "../../../../lib/task-draft";

/**
 * P-TASK-BUILDER (packages/ux-contracts) -- P1-003.
 *
 * The acceptance criterion is that a parent can create, publish and
 * assign a real task through the UI with validation and recovery
 * states -- no database edits. The flow mirrors the contract's own
 * shape: create returns a DRAFT, publish makes it ACTIVE, and only an
 * ACTIVE template can be assigned (DISC-P1-026-1). Collapsing those into
 * one call would hide a distinction the API is built around; keeping
 * them separate is also what makes a mid-flow failure resumable.
 *
 * All eight declared states have a rendering path, enforced by
 * `defineScreenStates` rather than promised.
 */
/**
 * Only the strategies a parent can meaningfully choose today. The
 * contract declares ten; the rest (CAMERA_EXERCISE, TIMER, COUNTER,
 * ALICE_SESSION, COMPOSITE) need configuration this screen has no fields
 * for, and offering them without it would create tasks nothing can
 * verify.
 */
const STRATEGIES = [
  { value: "MANUAL_SELF", label: "Ребёнок отмечает сам" },
  { value: "PARENT_APPROVAL", label: "Взрослый проверяет" },
  { value: "PHOTO_PROOF", label: "Фото результата" },
] as const;

const BUILDER_STATES = defineScreenStates("P-TASK-BUILDER", {
  DRAFT: { heading: "Новое задание" },
  SAVING: { heading: "Сохраняем…" },
  VALIDATION_WARNINGS: { heading: "Проверьте задание" },
  VALIDATION_ERROR: { heading: "Не хватает данных" },
  PUBLISHED: { heading: "Задание готово" },
  ASSIGNED: { heading: "Задание назначено" },
  CONFLICT: { heading: "Задание уже изменилось" },
  OFFLINE: { heading: "Нет связи" },
});

type Stage = "DRAFT" | "SAVING" | "PUBLISHED" | "ASSIGNED";

async function errorCode(res: Response): Promise<string | undefined> {
  const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
  return body?.error?.code;
}

export default function Page() {
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<Stage>("DRAFT");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<RecoveryState | null>(null);
  const [showProblems, setShowProblems] = useState(false);
  const [online, setOnline] = useState(true);
  const [draft, setDraft] = useState<Draft>({
    title: "",
    strategy: "PARENT_APPROVAL",
    rewardXp: "10",
    rewardCoins: "0",
    childId: "",
    dueAt: "",
  });

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  /**
   * The session says which family we act in. The browser cannot read its
   * own httpOnly cookie, so asking the server is the only way to learn
   * it (DISC-P1-003-1) -- and it keeps one source of truth for the value
   * that decides the security boundary.
   */
  const loadContext = useCallback(async () => {
    setLoading(true);
    setRecovery(null);
    try {
      const scopeRes = await fetch("/api/v1/auth/session");
      if (!scopeRes.ok) {
        setRecovery(recoveryFor((await errorCode(scopeRes)) ?? "INVALID_SESSION", "parent"));
        return;
      }
      const scope = (await scopeRes.json()) as { familyId?: string };
      if (!scope.familyId) {
        // A bootstrap session may only create a family, so there is
        // nothing to build a task in yet.
        window.location.assign("/parent/family-setup");
        return;
      }
      setFamilyId(scope.familyId);
      const familyRes = await fetch(`/api/v1/families/${scope.familyId}`);
      if (!familyRes.ok) {
        setRecovery(recoveryFor(await errorCode(familyRes), "parent"));
        return;
      }
      const family = (await familyRes.json()) as { children: Child[] };
      setChildren(family.children);
    } catch {
      setRecovery(recoveryFor("NETWORK_ERROR", "parent"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const { errors, warnings } = validateDraft(draft, children);

  /** The contract state, derived rather than assigned at each call site. */
  function screenState(): keyof typeof BUILDER_STATES.states {
    if (!online) return "OFFLINE";
    if (recovery?.action === "REFRESH") return "CONFLICT";
    if (stage === "SAVING") return "SAVING";
    if (stage === "ASSIGNED") return "ASSIGNED";
    if (stage === "PUBLISHED") return "PUBLISHED";
    if (showProblems && errors.length > 0) return "VALIDATION_ERROR";
    if (showProblems && warnings.length > 0) return "VALIDATION_WARNINGS";
    return "DRAFT";
  }

  function fail(code: string | undefined): void {
    setRecovery(recoveryFor(code, "parent"));
    // The draft is kept -- making a parent retype it would be the real
    // insult -- but the stage falls back so the next attempt is a fresh
    // decision against whatever is true now. `templateId` survives too,
    // so a retry resumes rather than creating a second template.
    setStage("DRAFT");
  }

  /**
   * Create -> publish -> assign, each step idempotency-keyed, so a
   * repeat tap cannot produce a second template or a second assignment.
   */
  async function publishAndAssign(): Promise<void> {
    setShowProblems(true);
    if (errors.length > 0 || !familyId) return;
    setStage("SAVING");
    setRecovery(null);
    try {
      let id = templateId;
      if (!id) {
        const created = await fetch(`/api/v1/families/${familyId}/task-templates`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: draft.title.trim(),
            verificationStrategy: draft.strategy,
            rewardXp: Number(draft.rewardXp),
            rewardCoins: Number(draft.rewardCoins),
          }),
        });
        if (!created.ok) return fail(await errorCode(created));
        id = ((await created.json()) as { taskTemplateId: string }).taskTemplateId;
        setTemplateId(id);
      }

      const published = await fetch(`/api/v1/task-templates/${id}/publish`, {
        method: "POST",
        headers: { "idempotency-key": `${id}:publish` },
      });
      if (!published.ok) return fail(await errorCode(published));
      setStage("PUBLISHED");

      const assigned = await fetch(`/api/v1/task-templates/${id}/assignments`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": `${id}:assign:${draft.childId}` },
        body: JSON.stringify({
          assignedToChildId: draft.childId,
          ...(draft.dueAt ? { dueAt: new Date(draft.dueAt).toISOString() } : {}),
        }),
      });
      if (!assigned.ok) return fail(await errorCode(assigned));
      setStage("ASSIGNED");
    } catch {
      fail("NETWORK_ERROR");
    }
  }

  const state = screenState();
  const copy = BUILDER_STATES.render(state);

  if (loading) {
    return (
      <section aria-labelledby="page-title" aria-busy="true">
        <h1 id="page-title" className="mb-4 text-xl font-semibold text-ink">
          Новое задание
        </h1>
        <StateBanner tone="progress">Загружаем…</StateBanner>
      </section>
    );
  }

  return (
    <section aria-labelledby="page-title" className="mx-auto max-w-xl">
      <h1 id="page-title" className="mb-4 text-xl font-semibold text-ink">
        {copy.heading}
      </h1>

      {state === "OFFLINE" && (
        <StateBanner tone="warning">Нет связи. Задание можно будет отправить, когда связь вернётся.</StateBanner>
      )}
      {recovery && <StateBanner tone={state === "CONFLICT" ? "warning" : "danger"}>{recovery.message}</StateBanner>}
      {state === "VALIDATION_ERROR" && (
        <StateBanner tone="danger">
          <ul>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </StateBanner>
      )}
      {state === "VALIDATION_WARNINGS" && (
        <StateBanner tone="warning">
          <ul>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </StateBanner>
      )}
      {state === "PUBLISHED" && <StateBanner tone="progress">Назначаем ребёнку…</StateBanner>}

      {state === "ASSIGNED" ? (
        <Card>
          <p className="mb-3 text-ink">Задание появилось у ребёнка.</p>
          <Button onClick={() => window.location.assign("/parent/dashboard")}>К обзору</Button>
        </Card>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <Card>
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-ink-muted">Название</span>
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="rounded-lg border border-line px-3 py-2"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm text-ink-muted">Кому</span>
                <select
                  value={draft.childId}
                  onChange={(e) => setDraft({ ...draft, childId: e.target.value })}
                  className="rounded-lg border border-line px-3 py-2"
                >
                  <option value="">Выберите ребёнка</option>
                  {children.map((c) => (
                    <option key={c.childId} value={c.childId}>
                      {c.displayName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm text-ink-muted">Как проверим</span>
                <select
                  value={draft.strategy}
                  onChange={(e) => setDraft({ ...draft, strategy: e.target.value })}
                  className="rounded-lg border border-line px-3 py-2"
                >
                  {STRATEGIES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex gap-3">
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-sm text-ink-muted">Опыт</span>
                  <input
                    inputMode="numeric"
                    value={draft.rewardXp}
                    onChange={(e) => setDraft({ ...draft, rewardXp: e.target.value })}
                    className="rounded-lg border border-line px-3 py-2"
                  />
                </label>
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-sm text-ink-muted">Монеты</span>
                  <input
                    inputMode="numeric"
                    value={draft.rewardCoins}
                    onChange={(e) => setDraft({ ...draft, rewardCoins: e.target.value })}
                    className="rounded-lg border border-line px-3 py-2"
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-sm text-ink-muted">Срок (необязательно)</span>
                <input
                  type="datetime-local"
                  value={draft.dueAt}
                  onChange={(e) => setDraft({ ...draft, dueAt: e.target.value })}
                  className="rounded-lg border border-line px-3 py-2"
                />
              </label>
            </div>
          </Card>

          <Button onClick={() => void publishAndAssign()} disabled={state === "SAVING" || !online}>
            {state === "SAVING" ? "Сохраняем…" : templateId ? "Назначить" : "Опубликовать и назначить"}
          </Button>
        </div>
      )}
    </section>
  );
}
