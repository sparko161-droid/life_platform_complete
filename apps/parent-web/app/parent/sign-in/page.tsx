"use client";

import { useState } from "react";
import { Button, StateBanner } from "@life/ui";

/**
 * P-REGISTRATION (packages/ux-contracts, frozen in P1-032).
 *
 * A client component because it owns form state, but note what it does
 * *not* own: the session. Submitting posts to a server route that sets
 * an httpOnly cookie; nothing here ever sees or stores a session value.
 *
 * The failure copy is deliberately one message. The API returns the same
 * failure for a wrong password, an unknown email, a suspended account
 * and a non-member, because telling them apart would let anyone discover
 * which addresses are registered. Narrowing it here would rebuild that
 * oracle in the UI.
 */
type Mode = "sign-in" | "sign-up";
type State = "READY" | "SUBMITTING" | "VALIDATION_ERROR" | "SIGN_IN_FAILED" | "TOO_MANY_ATTEMPTS" | "NETWORK_ERROR" | "CHECK_CONSENT";

export default function Page() {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<State>("READY");

  const busy = state === "SUBMITTING";

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!email.trim() || !password) {
      setState("VALIDATION_ERROR");
      return;
    }
    setState("SUBMITTING");

    const endpoint = mode === "sign-up" ? "/api/v1/auth/sign-up" : "/api/auth/sign-in";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (mode === "sign-up") {
        // Sign-up issues no session by design: consent has to be
        // accepted first (docs/product/family-lifecycle.md).
        setState(res.ok ? "CHECK_CONSENT" : "SIGN_IN_FAILED");
        return;
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
        setState(body?.error?.code === "TOO_MANY_ATTEMPTS" ? "TOO_MANY_ATTEMPTS" : "SIGN_IN_FAILED");
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
      <h1 id="page-title" className="mb-4 text-xl font-semibold text-ink">
        {mode === "sign-up" ? "Создать аккаунт" : "Вход"}
      </h1>

      {state === "VALIDATION_ERROR" && <StateBanner tone="warning">Заполните почту и пароль.</StateBanner>}
      {state === "SIGN_IN_FAILED" && <StateBanner tone="danger">Не получилось. Проверьте данные и попробуйте ещё раз.</StateBanner>}
      {state === "TOO_MANY_ATTEMPTS" && <StateBanner tone="danger">Слишком много попыток. Попробуйте позже.</StateBanner>}
      {state === "NETWORK_ERROR" && <StateBanner tone="danger">Нет связи с сервисом. Попробуйте ещё раз.</StateBanner>}
      {state === "CHECK_CONSENT" && <StateBanner tone="success">Аккаунт создан. Примите условия, чтобы продолжить.</StateBanner>}

      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-ink-muted">Почта</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-line px-3 py-2"
            required
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-ink-muted">Пароль</span>
          <input
            type="password"
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-line px-3 py-2"
            required
          />
        </label>

        <Button type="submit" disabled={busy}>
          {busy ? "Подождите…" : mode === "sign-up" ? "Создать аккаунт" : "Войти"}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "sign-up" ? "sign-in" : "sign-up");
          setState("READY");
        }}
        className="mt-4 min-h-11 text-sm text-ink-muted underline"
      >
        {mode === "sign-up" ? "У меня уже есть аккаунт" : "Создать аккаунт"}
      </button>
    </section>
  );
}
