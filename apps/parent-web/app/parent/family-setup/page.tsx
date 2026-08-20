"use client";

import { useState } from "react";
import { Button, Card, StateBanner } from "@life/ui";

/**
 * P-FAMILY-SETUP (packages/ux-contracts, frozen in P1-032).
 *
 * The only screen a bootstrap session can use. A parent who signed in but
 * belongs to no family holds a session with no familyId, so every
 * family-scoped call fails closed for them (ADR-0006, DISC-P1-031-1) --
 * this screen is genuinely all they can do, enforced by the API rather
 * than by hiding buttons.
 *
 * Child provisioning is here rather than on a child screen for the same
 * structural reason: a child never holds a credential, so the only actor
 * who can open a child's access is an authenticated parent.
 */
type Step = "NO_FAMILY" | "FAMILY_READY_NO_CHILDREN" | "CHILD_ADDED" | "CHILD_ACCESS_READY";
type Problem = null | "VALIDATION_ERROR" | "NETWORK_ERROR" | "AGE_OUT_OF_RANGE";

/** Confirmed product range, HD-P1-034-1. */
const MIN_AGE = 4;
const MAX_AGE = 12;

export default function Page() {
  const [step, setStep] = useState<Step>("NO_FAMILY");
  const [problem, setProblem] = useState<Problem>(null);
  const [busy, setBusy] = useState(false);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [childName, setChildName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [childId, setChildId] = useState<string | null>(null);

  async function call<T>(path: string, body: unknown): Promise<T | null> {
    setBusy(true);
    setProblem(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setProblem("VALIDATION_ERROR");
        return null;
      }
      return (await res.json()) as T;
    } catch {
      setProblem("NETWORK_ERROR");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function createFamily(): Promise<void> {
    // The API derives the owner from the session; there is no field here
    // for it, because a client-supplied owner id is exactly what
    // OWNER_MUST_BE_SELF rejects.
    const created = await call<{ familyId: string }>("/api/v1/families", {});
    if (created) {
      setFamilyId(created.familyId);
      setStep("FAMILY_READY_NO_CHILDREN");
    }
  }

  async function addChild(): Promise<void> {
    const year = Number(birthYear);
    if (!childName.trim() || !Number.isInteger(year)) {
      setProblem("VALIDATION_ERROR");
      return;
    }
    // Checked here for a clear message, and again by the API -- client
    // gating is UX only (docs/security/permissions.md).
    const age = new Date().getFullYear() - year;
    if (age < MIN_AGE || age > MAX_AGE) {
      setProblem("AGE_OUT_OF_RANGE");
      return;
    }
    const child = await call<{ childId: string }>(`/api/v1/families/${familyId}/children`, {
      displayName: childName.trim(),
      birthYear: year,
    });
    if (child) {
      setChildId(child.childId);
      setStep("CHILD_ADDED");
    }
  }

  async function openChildAccess(): Promise<void> {
    const session = await call<{ sessionId: string }>("/api/v1/auth/child-sessions", { childId });
    if (session) setStep("CHILD_ACCESS_READY");
  }

  return (
    <section aria-labelledby="page-title" className="mx-auto max-w-md">
      <h1 id="page-title" className="mb-4 text-xl font-semibold text-ink">
        Настройка семьи
      </h1>

      {problem === "VALIDATION_ERROR" && <StateBanner tone="warning">Проверьте данные и попробуйте ещё раз.</StateBanner>}
      {problem === "AGE_OUT_OF_RANGE" && (
        <StateBanner tone="warning">{`Сейчас приложение рассчитано на детей от ${MIN_AGE} до ${MAX_AGE} лет.`}</StateBanner>
      )}
      {problem === "NETWORK_ERROR" && <StateBanner tone="danger">Нет связи с сервисом. Попробуйте ещё раз.</StateBanner>}

      <div className="mt-4 flex flex-col gap-4">
        <Card>
          <h2 className="mb-2 font-medium text-ink">Шаг 1. Семья</h2>
          {step === "NO_FAMILY" ? (
            <Button onClick={createFamily} disabled={busy}>
              {busy ? "Подождите…" : "Создать семью"}
            </Button>
          ) : (
            <p className="text-sm text-ink-muted">Семья создана.</p>
          )}
        </Card>

        {step !== "NO_FAMILY" && (
          <Card>
            <h2 className="mb-2 font-medium text-ink">Шаг 2. Ребёнок</h2>
            {step === "FAMILY_READY_NO_CHILDREN" ? (
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-ink-muted">Имя</span>
                  <input
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    className="rounded-lg border border-line px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-ink-muted">Год рождения</span>
                  <input
                    inputMode="numeric"
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    className="rounded-lg border border-line px-3 py-2"
                  />
                </label>
                <Button onClick={addChild} disabled={busy}>
                  {busy ? "Подождите…" : "Добавить ребёнка"}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-ink-muted">Профиль ребёнка создан.</p>
            )}
          </Card>
        )}

        {(step === "CHILD_ADDED" || step === "CHILD_ACCESS_READY") && (
          <Card>
            <h2 className="mb-2 font-medium text-ink">Шаг 3. Доступ ребёнка</h2>
            {step === "CHILD_ADDED" ? (
              <>
                <p className="mb-2 text-sm text-ink-muted">
                  Ребёнку не нужен пароль — доступ открывает родитель на устройстве ребёнка.
                </p>
                <Button onClick={openChildAccess} disabled={busy}>
                  {busy ? "Подождите…" : "Открыть доступ"}
                </Button>
              </>
            ) : (
              <p className="text-sm text-ink-muted">Доступ открыт.</p>
            )}
          </Card>
        )}

        {step === "CHILD_ACCESS_READY" && (
          <Button onClick={() => window.location.assign("/parent/dashboard")}>Готово</Button>
        )}
      </div>
    </section>
  );
}
