"use client";

import { useState } from "react";
import { Button, StateBanner } from "@life/ui";

/**
 * Child device pairing entry (P1-036), closing DISC-P1-032-1.
 *
 * The child types the code a parent read out. Nothing here is a
 * credential the child owns or keeps: the code is spent immediately, and
 * what it becomes -- a session -- is written into an httpOnly cookie by
 * the route handler and never seen by this component.
 *
 * Copy is written for a reader aged 4-12 (HD-P1-034-1): short sentences,
 * no technical nouns, and a failure that tells the child what to do next
 * rather than what went wrong. "Код не подошёл" plus "попроси взрослого"
 * is actionable; "недействительный код" is not.
 */
type State = "READY" | "SUBMITTING" | "EMPTY" | "FAILED" | "NETWORK_ERROR";

export default function Page() {
  const [code, setCode] = useState("");
  const [state, setState] = useState<State>("READY");

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!code.trim()) {
      setState("EMPTY");
      return;
    }
    setState("SUBMITTING");
    try {
      const res = await fetch("/api/pair", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      if (!res.ok) {
        setState("FAILED");
        return;
      }
      const { next } = (await res.json()) as { next: string };
      window.location.assign(next);
    } catch {
      setState("NETWORK_ERROR");
    }
  }

  return (
    <section aria-labelledby="page-title" className="mx-auto max-w-sm">
      <h1 id="page-title" className="mb-2 text-2xl font-semibold text-ink">
        Привет!
      </h1>
      <p className="mb-4 text-ink-muted">Попроси взрослого показать код и введи его здесь.</p>

      {state === "EMPTY" && <StateBanner tone="warning">Сначала введи код.</StateBanner>}
      {state === "FAILED" && <StateBanner tone="danger">Код не подошёл. Попроси взрослого создать новый.</StateBanner>}
      {state === "NETWORK_ERROR" && <StateBanner tone="danger">Нет связи. Попробуй ещё раз.</StateBanner>}

      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-ink-muted">Код</span>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            // Large and widely spaced: this is typed by a young child,
            // often on a small screen.
            className="rounded-lg border border-line px-3 py-3 text-center text-2xl tracking-[0.3em]"
            aria-describedby="code-hint"
          />
        </label>
        <p id="code-hint" className="text-sm text-ink-muted">
          Восемь цифр.
        </p>

        <Button type="submit" surface="child" disabled={state === "SUBMITTING"}>
          {state === "SUBMITTING" ? "Проверяем…" : "Войти"}
        </Button>
      </form>
    </section>
  );
}
