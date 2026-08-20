import assert from "node:assert/strict";
import { test } from "node:test";
import { KNOWN_RECOVERY_CODES, recoveryFor } from "../src/recovery.js";

/**
 * Recovery states (P1-016). docs/ux/error-recovery.md's requirement is
 * that a failure never leaves the user at a dead end, so the properties
 * worth asserting are about what the user can *do*, not about wording.
 */

test("every known code yields a message and a defined action", () => {
  for (const code of KNOWN_RECOVERY_CODES) {
    for (const surface of ["parent", "child"] as const) {
      const r = recoveryFor(code, surface);
      assert.ok(r.message.length > 0, `${code}/${surface} has no message`);
      assert.ok(r.action, `${code}/${surface} has no action`);
    }
  }
});

test("an action that is not NONE always has a label to put on the control", () => {
  for (const code of KNOWN_RECOVERY_CODES) {
    for (const surface of ["parent", "child"] as const) {
      const r = recoveryFor(code, surface);
      if (r.action !== "NONE" && r.action !== "ASK_ADULT") {
        assert.ok(r.actionLabel, `${code}/${surface} offers ${r.action} with no label`);
      }
    }
  }
});

test("an unknown code falls back instead of surfacing itself", () => {
  const r = recoveryFor("SOME_INTERNAL_CODE_NOBODY_MAPPED");
  // Showing a raw code leaks internal vocabulary (docs/ux/ui-language.md
  // forbids it) and tells the user nothing they can act on.
  assert.ok(!r.message.includes("SOME_INTERNAL_CODE_NOBODY_MAPPED"));
  assert.ok(r.message.length > 0);
});

test("an absent code still yields a usable recovery", () => {
  const r = recoveryFor(undefined);
  assert.ok(r.message.length > 0);
  assert.ok(r.action);
});

test("a conflict is never presented as safe to retry", () => {
  for (const surface of ["parent", "child"] as const) {
    const r = recoveryFor("CONFLICT", surface);
    // The state moved underneath us. Repeating the same request would
    // apply a decision made against stale state -- worse than useless.
    assert.equal(r.retrySafe, false);
    assert.equal(r.action, "REFRESH");
  }
});

test("a child is never told to sign in -- they hold no credentials by contract", () => {
  for (const code of KNOWN_RECOVERY_CODES) {
    const r = recoveryFor(code, "child");
    // ADR-0006 D3: a child has no credentials, so "войдите снова" would
    // be advice they cannot follow.
    assert.notEqual(r.action, "SIGN_IN", `child recovery for ${code} tells them to sign in`);
  }
  assert.equal(recoveryFor("INVALID_SESSION", "child").action, "ASK_ADULT");
});

test("a child's session failure sends them to an adult, not to a dead end", () => {
  const r = recoveryFor("MISSING_SESSION", "child");
  assert.equal(r.action, "ASK_ADULT");
  assert.ok(r.message.includes("взрослого"));
});

test("recovery copy contains no Latin-script leakage", () => {
  // The same rule @life/ui-language enforces on UI_STRINGS applies to
  // these, since they are shown to users verbatim.
  for (const code of KNOWN_RECOVERY_CODES) {
    for (const surface of ["parent", "child"] as const) {
      const { message } = recoveryFor(code, surface);
      assert.doesNotMatch(message, /[A-Za-z]{2,}/u, `${code}/${surface} leaks Latin text: ${message}`);
    }
  }
});
