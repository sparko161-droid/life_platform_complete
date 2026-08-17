import assert from "node:assert/strict";
import { test } from "node:test";
import {
  currentCorrelation,
  runWithCausation,
  runWithNewCorrelation,
} from "../src/correlation.js";

test("no context outside of a run* call", () => {
  assert.equal(currentCorrelation(), undefined);
});

test("runWithNewCorrelation sets equal correlationId and causationId", () => {
  runWithNewCorrelation((ctx) => {
    assert.equal(ctx.correlationId, ctx.causationId);
    assert.equal(currentCorrelation()?.correlationId, ctx.correlationId);
  });
  assert.equal(currentCorrelation(), undefined);
});

test("runWithCausation keeps correlationId but issues a new causationId", () => {
  runWithNewCorrelation((root) => {
    runWithCausation(root, (child) => {
      assert.equal(child.correlationId, root.correlationId);
      assert.notEqual(child.causationId, root.causationId);
    });
  });
});

test("nested contexts don't leak into unrelated async work", async () => {
  const seen: (string | undefined)[] = [];
  await Promise.all([
    (async () => {
      await runWithNewCorrelation(async (ctx) => {
        await new Promise((r) => setTimeout(r, 5));
        seen.push(currentCorrelation()?.correlationId === ctx.correlationId ? "a-ok" : "a-fail");
      });
    })(),
    (async () => {
      await runWithNewCorrelation(async (ctx) => {
        await new Promise((r) => setTimeout(r, 1));
        seen.push(currentCorrelation()?.correlationId === ctx.correlationId ? "b-ok" : "b-fail");
      });
    })(),
  ]);
  assert.deepEqual(new Set(seen), new Set(["a-ok", "b-ok"]));
});
