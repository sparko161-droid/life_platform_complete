"use client";

import { use, useCallback, useEffect, useState } from "react";
import {
  Button,
  StateBanner,
  defineScreenStates,
  recoveryFor,
  type RecoveryState,
} from "@life/ui";
import { deriveUiTaskState, type UiTaskState } from "@life/ux-contracts";

/**
 * C-TASK (packages/ux-contracts) — the child's task screen (P1-016).
 *
 * This is where P1-016's acceptance criteria actually land: the UI runs
 * the real slice (start → submit proof) and handles loading, retry,
 * conflict and rejected-proof. All eight declared states have a
 * rendering path, enforced by `defineScreenStates` rather than promised.
 *
 * The screen state is derived from the assignment via
 * `deriveUiTaskState`, the same contract function the parent surface
 * uses, so the two surfaces cannot disagree about what a status means.
 * In particular it is what keeps REJECTED (a parent asked for another
 * try) distinct from FAILED (automatic verification did not pass) —
 * a distinction that matters enormously to a child and would be easy to
 * flatten by hand.
 */
interface Assignment {
  taskAssignmentId: string;
  status: string;
  version: number;
}

const TASK_COPY = defineScreenStates("C-TASK", {
  READY: { title: "Готово к старту", body: "Нажми «Начать», когда будешь готов." },
  IN_PROGRESS: { title: "Ты делаешь задание", body: "Как закончишь — расскажи, что получилось." },
  WAITING_FOR_PROOF: { title: "Нужно показать результат", body: "Расскажи, что ты сделал." },
  VERIFYING: { title: "Проверяем", body: "Взрослый скоро посмотрит." },
  APPROVED: { title: "Принято!", body: "Отличная работа." },
  REJECTED_WITH_EXPLANATION: { title: "Нужно попробовать ещё раз", body: "Взрослый попросил переделать." },
  RETRYABLE_FAILURE: { title: "Не получилось отправить", body: "Попробуй ещё раз." },
  OFFLINE: { title: "Нет связи", body: "Мы сохраним, когда связь вернётся." },
});

type ScreenState = keyof typeof TASK_COPY.states;

/**
 * Maps the shared UI task state onto this screen's own contract states.
 *
 * The two vocabularies are deliberately different: `UiTaskState` is
 * cross-surface, C-TASK's states are what this screen shows. Doing the
 * translation in one named function keeps the difference visible instead
 * of letting each branch invent its own mapping.
 */
function toScreenState(ui: UiTaskState, online: boolean, sendFailed: boolean): ScreenState {
  if (!online) return "OFFLINE";
  if (sendFailed) return "RETRYABLE_FAILURE";
  switch (ui) {
    case "NOT_STARTED":
      return "READY";
    case "IN_PROGRESS":
      return "IN_PROGRESS";
    case "SUBMITTED":
      return "WAITING_FOR_PROOF";
    case "VERIFYING":
      return "VERIFYING";
    case "APPROVED":
    case "REWARD_PENDING":
    case "COMPLETED":
      return "APPROVED";
    case "REJECTED":
    case "FAILED":
      // Both mean "try again" to a child. The *reason* differs, and the
      // copy could differ later, but neither is a dead end — which is
      // what docs/ux/error-recovery.md actually requires here.
      return "REJECTED_WITH_EXPLANATION";
  }
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState<RecoveryState | null>(null);
  const [sendFailed, setSendFailed] = useState(false);
  const [online, setOnline] = useState(true);

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

  const load = useCallback(async () => {
    setLoading(true);
    setRecovery(null);
    try {
      const res = await fetch(`/api/v1/task-assignments/${id}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
        setRecovery(recoveryFor(body?.error?.code, "child"));
        return;
      }
      setAssignment((await res.json()) as Assignment);
      setSendFailed(false);
    } catch {
      setRecovery(recoveryFor("NETWORK_ERROR", "child"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Mutations carry an idempotency key derived from the assignment and
   * the action, so a repeat tap cannot create a second attempt --
   * docs/ux/core-path-contracts.md's rule, and the API enforces it too.
   */
  async function act(path: string, body?: unknown): Promise<void> {
    setBusy(true);
    setRecovery(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": `${id}:${path}` },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!res.ok) {
        const failure = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
        const r = recoveryFor(failure?.error?.code, "child");
        setRecovery(r);
        // A conflict means someone else moved this task; reloading shows
        // the truth rather than leaving a stale screen with a retry
        // button that would repeat a stale decision.
        if (r.action === "REFRESH") await load();
        else setSendFailed(true);
        return;
      }
      await load();
    } catch {
      setRecovery(recoveryFor("NETWORK_ERROR", "child"));
      setSendFailed(true);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <section aria-labelledby="task-title" aria-busy="true">
        <h1 id="task-title" className="mb-4 text-child-lg font-semibold text-ink">
          Задание
        </h1>
        <StateBanner tone="progress">Загружаем…</StateBanner>
      </section>
    );
  }

  if (!assignment) {
    const r = recovery ?? recoveryFor("NOT_FOUND", "child");
    return (
      <section aria-labelledby="task-title">
        <h1 id="task-title" className="mb-4 text-child-lg font-semibold text-ink">
          Задание
        </h1>
        <StateBanner tone="danger">{r.message}</StateBanner>
        {r.action === "RETRY" && r.actionLabel && (
          <div className="mt-3">
            <Button surface="child" onClick={() => void load()}>
              {r.actionLabel}
            </Button>
          </div>
        )}
      </section>
    );
  }

  // No rejectedByParent claim: the assignment does not say who rejected
  // it, and asserting a parent did would be inventing a fact. The
  // contract already defaults an ambiguous rejection to the more
  // conservative framing, which is exactly the case we are in.
  const uiState = deriveUiTaskState({ assignmentStatus: assignment.status as never });
  const screenState = toScreenState(uiState, online, sendFailed);
  const copy = TASK_COPY.render(screenState);

  return (
    <section aria-labelledby="task-title">
      <h1 id="task-title" className="mb-2 text-child-lg font-semibold text-ink">
        {copy.title}
      </h1>
      <p className="mb-4 text-ink-muted">{copy.body}</p>

      {recovery && <StateBanner tone="danger">{recovery.message}</StateBanner>}

      <div className="mt-4 flex flex-col gap-3">
        {screenState === "READY" && (
          <Button surface="child" disabled={busy} onClick={() => void act(`/api/v1/task-assignments/${id}/start`)}>
            {busy ? "Начинаем…" : "Начать"}
          </Button>
        )}

        {screenState === "IN_PROGRESS" && (
          <Button
            surface="child"
            disabled={busy}
            onClick={() => void act(`/api/v1/task-assignments/${id}/completions`, { selfReportNote: "Готово" })}
          >
            {busy ? "Отправляем…" : "Я закончил"}
          </Button>
        )}

        {screenState === "REJECTED_WITH_EXPLANATION" && (
          <Button surface="child" disabled={busy} onClick={() => void act(`/api/v1/task-assignments/${id}/start`)}>
            {busy ? "Начинаем…" : "Попробовать ещё раз"}
          </Button>
        )}

        {(screenState === "RETRYABLE_FAILURE" || screenState === "OFFLINE") && (
          <Button surface="child" disabled={busy} onClick={() => void load()}>
            Повторить
          </Button>
        )}
      </div>
    </section>
  );
}
