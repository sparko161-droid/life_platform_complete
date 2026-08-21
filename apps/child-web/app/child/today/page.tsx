"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, EmptyState, StateBanner, defineScreenStates, recoveryFor, type RecoveryState } from "@life/ui";
import { cardInvitation, deriveTodayState, type TodayCard } from "../../../lib/today";

/**
 * C-TODAY (packages/ux-contracts) — P1-004.
 *
 * Every state the contract declares has a rendering path, and that is
 * enforced rather than promised: `defineScreenStates` is keyed on
 * C-TODAY's own literal state union, so omitting one -- or keeping one
 * the contract has dropped -- fails to compile.
 *
 * Cards show the task's title and what the child can do next, never the
 * assignment status. "SUBMITTED" is an internal label, and
 * docs/ux/ui-language.md forbids putting those in front of a child.
 *
 * Failures route through `recoveryFor(..., "child")`, so a child is
 * never told to sign in: they hold no credentials by contract
 * (ADR-0006 D3), and the only recovery available to them is to ask an
 * adult.
 */

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

export default function Page() {
  const [cards, setCards] = useState<TodayCard[] | null>(null);
  const [everHadTasks, setEverHadTasks] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncFailed, setSyncFailed] = useState(false);
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

  /**
   * No childId is sent. The server derives it from the session, which is
   * the only version of this that is actually safe: a childId in the
   * query is a claim by the caller, and until P1-004 it was trusted.
   */
  const load = useCallback(async () => {
    setLoading(true);
    setRecovery(null);
    try {
      const res = await fetch("/api/v1/child/today");
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
        setRecovery(recoveryFor(body?.error?.code, "child"));
        setSyncFailed(true);
        return;
      }
      const body = (await res.json()) as { assignments: TodayCard[]; everHadTasks?: boolean };
      setCards(body.assignments);
      setEverHadTasks(body.everHadTasks ?? body.assignments.length > 0);
      setSyncFailed(false);
    } catch {
      setRecovery(recoveryFor("NETWORK_ERROR", "child"));
      setSyncFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <section aria-labelledby="page-title" aria-busy="true">
        <h1 id="page-title" className="mb-4 text-child-lg font-semibold text-ink">
          Мой день
        </h1>
        <StateBanner tone="progress">Загружаем…</StateBanner>
      </section>
    );
  }

  const state = deriveTodayState({ cards, online, syncFailed, everHadTasks });
  const copy = TODAY_STATES.render(state);
  const hasCards = cards !== null && cards.length > 0;

  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title" className="mb-4 text-child-lg font-semibold text-ink">
        {copy.title}
      </h1>

      {(state === "OFFLINE" || state === "OVERDUE") && <StateBanner tone="warning">{copy.description}</StateBanner>}
      {state === "FAILED_SYNC" && (
        <>
          <StateBanner tone="danger">{recovery?.message ?? copy.description}</StateBanner>
          {/* Never a dead end: the child always has one thing to try. */}
          <div className="mt-3">
            <Button surface="child" onClick={() => void load()}>
              {recovery?.actionLabel ?? "Попробовать ещё раз"}
            </Button>
          </div>
        </>
      )}

      {hasCards ? (
        <ul className="mt-3 flex flex-col gap-2">
          {cards.map((card) => (
            <li key={card.taskAssignmentId}>
              {/* C-TODAY -> C-TASK is a declared exit edge in the screen
                  contract; without this link it was an edge nothing
                  could actually traverse. */}
              <a
                href={`/child/task/${card.taskAssignmentId}`}
                className="flex min-h-11 items-center justify-between gap-3 rounded-control border border-line px-3 py-3 text-ink"
              >
                <span>{card.title}</span>
                <span className="text-sm text-ink-muted">{cardInvitation(card.status)}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        state !== "FAILED_SYNC" && <EmptyState surface="child" title={copy.title} description={copy.description} />
      )}
    </section>
  );
}
