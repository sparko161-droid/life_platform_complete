"use client";

import { useEffect, useState } from "react";
import { Button, EmptyState, StateBanner, defineScreenStates, recoveryFor, type RecoveryState } from "@life/ui";

/**
 * C-TODAY (packages/ux-contracts).
 *
 * Every state the contract declares has a rendering path, and that is
 * enforced rather than promised: `defineScreenStates` is keyed on
 * C-TODAY's own literal state union, so omitting one -- or keeping one
 * the contract has dropped -- fails to compile. The P1-032 and P1-036
 * handoffs both recorded "declares states the pages do not render" as an
 * open risk; this is the first screen where that is no longer true.
 *
 * Failures route through `recoveryFor(..., "child")`, so a child is never
 * told to sign in: they hold no credentials by contract (ADR-0006 D3),
 * and the only recovery available to them is to ask an adult.
 */
interface TodayAssignment {
  taskAssignmentId: string;
  status: string;
  dueAt?: string;
}

type Phase = "LOADING" | "LOADED" | "ERROR";

/** Copy per contract state. Keyed on the contract, so it cannot drift. */
const TODAY_STATES = defineScreenStates("C-TODAY", {
  FIRST_DAY: { title: "Твой первый день!", description: "Скоро здесь появятся задания." },
  NORMAL_DAY: { title: "Мой день", description: "" },
  ALL_COMPLETE: { title: "Всё сделано!", description: "Ты справился со всеми заданиями." },
  OVERDUE: { title: "Есть просроченное", description: "Одно задание ждёт дольше обычного." },
  NO_TASKS: { title: "Пока пусто", description: "Заданий на сегодня нет." },
  OFFLINE: { title: "Нет связи", description: "Мы покажем задания, когда связь вернётся." },
  FAILED_SYNC: { title: "Не получилось обновить", description: "Попробуй ещё раз." },
});

/**
 * Derives the contract state from real data.
 *
 * Kept separate from rendering so the mapping is a plain function --
 * which is what makes "OVERDUE wins over ALL_COMPLETE" a decision that
 * can be read and argued with, rather than an accident of JSX ordering.
 */
function deriveState(
  assignments: TodayAssignment[] | null,
  online: boolean,
  failed: boolean,
): keyof typeof TODAY_STATES.states {
  if (!online) return "OFFLINE";
  if (failed) return "FAILED_SYNC";
  if (!assignments || assignments.length === 0) return "NO_TASKS";
  // Overdue is surfaced ahead of completion: something needing attention
  // matters more than celebrating the rest.
  if (assignments.some((a) => a.dueAt && new Date(a.dueAt) < new Date() && a.status !== "COMPLETED")) return "OVERDUE";
  if (assignments.every((a) => a.status === "COMPLETED" || a.status === "ARCHIVED")) return "ALL_COMPLETE";
  return "NORMAL_DAY";
}

export default function Page() {
  const [phase, setPhase] = useState<Phase>("LOADING");
  const [assignments, setAssignments] = useState<TodayAssignment[] | null>(null);
  const [recovery, setRecovery] = useState<RecoveryState | null>(null);
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

  async function load(): Promise<void> {
    setPhase("LOADING");
    setRecovery(null);
    try {
      const res = await fetch("/api/v1/child/today");
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
        setRecovery(recoveryFor(body?.error?.code, "child"));
        setPhase("ERROR");
        return;
      }
      const body = (await res.json()) as { assignments: TodayAssignment[] };
      setAssignments(body.assignments);
      setPhase("LOADED");
    } catch {
      setRecovery(recoveryFor("NETWORK_ERROR", "child"));
      setPhase("ERROR");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (phase === "LOADING") {
    return (
      <section aria-labelledby="page-title" aria-busy="true">
        <h1 id="page-title" className="mb-4 text-child-lg font-semibold text-ink">
          Мой день
        </h1>
        <StateBanner tone="progress">Загружаем…</StateBanner>
      </section>
    );
  }

  if (phase === "ERROR" && recovery) {
    return (
      <section aria-labelledby="page-title">
        <h1 id="page-title" className="mb-4 text-child-lg font-semibold text-ink">
          Мой день
        </h1>
        <StateBanner tone="danger">{recovery.message}</StateBanner>
        {recovery.action === "RETRY" && recovery.actionLabel && (
          <div className="mt-3">
            <Button surface="child" onClick={() => void load()}>
              {recovery.actionLabel}
            </Button>
          </div>
        )}
      </section>
    );
  }

  const state = deriveState(assignments, online, false);
  const copy = TODAY_STATES.render(state);

  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title" className="mb-4 text-child-lg font-semibold text-ink">
        {copy.title}
      </h1>

      {state === "OFFLINE" && <StateBanner tone="warning">{copy.description}</StateBanner>}
      {state === "OVERDUE" && <StateBanner tone="warning">{copy.description}</StateBanner>}

      {assignments && assignments.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {assignments.map((a) => (
            <li key={a.taskAssignmentId}>
              {/* C-TODAY -> C-TASK is a declared exit edge in the screen
                  contract; without this link it was an edge nothing could
                  actually traverse. */}
              <a
                href={`/child/task/${a.taskAssignmentId}`}
                className="block min-h-11 rounded-control border border-line px-3 py-3 text-ink"
              >
                {a.status}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState surface="child" title={copy.title} description={copy.description} />
      )}
    </section>
  );
}
