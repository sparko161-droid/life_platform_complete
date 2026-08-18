/**
 * Russian-only UI localization lint tests (P1-012).
 *
 * Strategy per task-registry (test_strategy: "Static lint fixtures with
 * forbidden-term regression cases."):
 *
 *   - lintString: clean Russian copy passes
 *   - lintString: each forbidden term is caught, with its preferred wording
 *     surfaced when ui-language.md states one
 *   - lintString: stray Latin words fall back to NON_CYRILLIC_TEXT
 *   - lintString: brand exceptions (MAX) do not trip either check
 *   - lintString: route paths and ALL_CAPS enum names are flagged as
 *     internal-identifier leaks
 *   - lintCatalog: aggregates violations across every catalog key
 *   - Regression: the canonical UI_STRINGS catalog itself is lint-clean
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { UI_STRINGS } from "../src/catalog.js";
import { FORBIDDEN_TERMS, lintCatalog, lintString } from "../src/lint.js";

// ---------------------------------------------------------------------------
// Clean Russian copy
// ---------------------------------------------------------------------------

test("lintString: clean Russian copy produces no violations", () => {
  assert.deepEqual(lintString("today_title", "Мой день"), []);
});

test("lintString: Russian copy with punctuation and ellipsis is clean", () => {
  assert.deepEqual(lintString("loading", "Загружаем…"), []);
});

// ---------------------------------------------------------------------------
// Forbidden terms
// ---------------------------------------------------------------------------

test("lintString: every FORBIDDEN_TERMS entry is caught on its own", () => {
  for (const { term, preferred } of FORBIDDEN_TERMS) {
    const violations = lintString("k", `Открыть ${term} сейчас`);
    const hit = violations.find((v) => v.code === "FORBIDDEN_TERM" && v.term === term);
    assert.ok(hit, `expected FORBIDDEN_TERM for "${term}"`);
    if (preferred) {
      assert.equal(hit!.suggestion, preferred);
    } else {
      assert.equal(hit!.suggestion, undefined);
    }
  }
});

test("lintString: forbidden term match is case-insensitive", () => {
  const violations = lintString("k", "task готово");
  assert.equal(violations.length, 1);
  assert.equal(violations[0]!.code, "FORBIDDEN_TERM");
  assert.equal(violations[0]!.term, "task");
});

test("lintString: a forbidden term is not also reported as NON_CYRILLIC_TEXT", () => {
  const violations = lintString("k", "Level готово");
  assert.equal(violations.length, 1);
  assert.equal(violations[0]!.code, "FORBIDDEN_TERM");
});

// ---------------------------------------------------------------------------
// Non-cyrillic (general Russian-only enforcement)
// ---------------------------------------------------------------------------

test("lintString: a Latin word not on the forbidden list is NON_CYRILLIC_TEXT", () => {
  const violations = lintString("k", "Submit сейчас");
  assert.equal(violations.length, 1);
  assert.equal(violations[0]!.code, "NON_CYRILLIC_TEXT");
  assert.equal(violations[0]!.term, "Submit");
});

test("lintString: multiple stray Latin words each produce a violation", () => {
  const violations = lintString("k", "Please Submit Now");
  assert.equal(violations.length, 3);
  assert.ok(violations.every((v) => v.code === "NON_CYRILLIC_TEXT"));
});

// ---------------------------------------------------------------------------
// Brand exceptions
// ---------------------------------------------------------------------------

test("lintString: MAX brand exception does not trip the Latin-script check", () => {
  assert.deepEqual(lintString("k", "Открыть в MAX"), []);
});

test("lintString: an unlisted brand-like word still trips NON_CYRILLIC_TEXT", () => {
  const violations = lintString("k", "Открыть в Telegram");
  assert.equal(violations.length, 1);
  assert.equal(violations[0]!.code, "NON_CYRILLIC_TEXT");
  assert.equal(violations[0]!.term, "Telegram");
});

// ---------------------------------------------------------------------------
// Internal identifier leaks
// ---------------------------------------------------------------------------

test("lintString: a route path is flagged as an internal-identifier leak", () => {
  const violations = lintString("k", "/child/today");
  assert.ok(violations.some((v) => v.code === "INTERNAL_IDENTIFIER_LEAK"));
});

test("lintString: an ALL_CAPS_SNAKE_CASE value is flagged as an internal-identifier leak", () => {
  const violations = lintString("k", "WAITING_FOR_PROOF");
  assert.ok(violations.some((v) => v.code === "INTERNAL_IDENTIFIER_LEAK"));
});

test("lintString: short ALL_CAPS like 'OK' is not flagged (below the length floor)", () => {
  const violations = lintString("k", "OK");
  assert.ok(!violations.some((v) => v.code === "INTERNAL_IDENTIFIER_LEAK"));
});

// ---------------------------------------------------------------------------
// lintCatalog
// ---------------------------------------------------------------------------

test("lintCatalog: aggregates violations across keys, empty catalog is clean", () => {
  assert.deepEqual(lintCatalog({}), []);
});

test("lintCatalog: mixes clean and dirty entries correctly", () => {
  const violations = lintCatalog({
    clean: "Мой день",
    dirty: "Task готово",
  });
  assert.equal(violations.length, 1);
  assert.equal(violations[0]!.key, "dirty");
});

// ---------------------------------------------------------------------------
// Regression: the canonical catalog stays lint-clean
// ---------------------------------------------------------------------------

test("regression: the canonical UI_STRINGS catalog is lint-clean", () => {
  assert.deepEqual(lintCatalog(UI_STRINGS), []);
});

test("regression: UI_STRINGS has an entry for every FORBIDDEN_TERMS term with a preferred wording", () => {
  const values = new Set(Object.values(UI_STRINGS));
  for (const { term, preferred } of FORBIDDEN_TERMS) {
    if (!preferred || preferred.includes("/")) continue; // contextual, not a single fixed string
    assert.ok(
      values.has(preferred),
      `UI_STRINGS is missing the canonical translation for "${term}" ("${preferred}")`,
    );
  }
});
