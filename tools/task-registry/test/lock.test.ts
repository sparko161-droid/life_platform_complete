import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { RegistryLockTimeoutError, withRegistryLock } from "../src/lock.js";

function scratchRegistryPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "lock-test-"));
  const path = join(dir, "registry.yaml");
  writeFileSync(path, "version: 1\ntasks: []\n", "utf8");
  return path;
}

test("withRegistryLock runs the callback and releases the lock", async () => {
  const path = scratchRegistryPath();
  const lockDir = join(path, "..", `.${path.split(/[\\/]/).pop()}.lock`);
  try {
    const result = await withRegistryLock(path, () => 42);
    assert.equal(result, 42);
    assert.equal(existsSync(lockDir), false);
  } finally {
    rmSync(path, { force: true });
  }
});

test("withRegistryLock releases the lock even when the callback throws", async () => {
  const path = scratchRegistryPath();
  try {
    await assert.rejects(() => withRegistryLock(path, () => {
      throw new Error("boom");
    }));
    // A second acquisition must succeed immediately -- proves the first
    // release actually ran instead of leaking the lock directory.
    const result = await withRegistryLock(path, () => "ok");
    assert.equal(result, "ok");
  } finally {
    rmSync(path, { force: true });
  }
});

test("a second concurrent acquisition waits for the first to release (serializes, doesn't race)", async () => {
  const path = scratchRegistryPath();
  try {
    const order: string[] = [];
    const first = withRegistryLock(path, async () => {
      order.push("first-start");
      await new Promise((r) => setTimeout(r, 150));
      order.push("first-end");
    });
    // Give `first` time to actually acquire before starting `second`.
    await new Promise((r) => setTimeout(r, 20));
    const second = withRegistryLock(path, () => {
      order.push("second-start");
    });
    await Promise.all([first, second]);
    assert.deepEqual(order, ["first-start", "first-end", "second-start"]);
  } finally {
    rmSync(path, { force: true });
  }
});

test("a stale lock (older than the staleness window) is recovered instead of blocking forever", async () => {
  const path = scratchRegistryPath();
  const lockDir = join(path, "..", `.${path.split(/[\\/]/).pop()}.lock`);
  try {
    mkdirSync(lockDir);
    const old = new Date(Date.now() - 60_000); // well past the 30s staleness window
    utimesSync(lockDir, old, old);

    const result = await withRegistryLock(path, () => "recovered", 2_000);
    assert.equal(result, "recovered");
  } finally {
    rmSync(path, { force: true });
    rmSync(lockDir, { recursive: true, force: true });
  }
});

test("a fresh lock held by someone else times out rather than recovering early", async () => {
  const path = scratchRegistryPath();
  const lockDir = join(path, "..", `.${path.split(/[\\/]/).pop()}.lock`);
  try {
    mkdirSync(lockDir); // fresh -- mtime is "now"
    await assert.rejects(
      () => withRegistryLock(path, () => "should not run", 300),
      RegistryLockTimeoutError,
    );
  } finally {
    rmSync(path, { force: true });
    rmSync(lockDir, { recursive: true, force: true });
  }
});

test("a lock that keeps re-appearing after removal still terminates in bounded time (regression: unbounded busy loop)", async () => {
  // Reproduces the real bug found while building this: the stale-recovery
  // and stat-failure branches used to `continue` straight back to the top
  // of the retry loop, skipping the deadline check and the sleep. If the
  // held lock keeps reappearing (a crashed-but-still-visible directory, or
  // -- as actually happened -- Windows/NTFS not dropping a just-removed
  // directory instantly) that was an unbounded busy loop, not a bounded
  // wait. Simulate "keeps reappearing" by recreating the (stale-looking,
  // but always fresh-by-the-time-it's-checked) lock directory faster than
  // acquire() can win the race, and assert the call still resolves via the
  // timeout within a small constant multiple of timeoutMs -- not by
  // spinning until the test framework kills it.
  const path = scratchRegistryPath();
  const lockDir = join(path, "..", `.${path.split(/[\\/]/).pop()}.lock`);
  let recreate: ReturnType<typeof setInterval> | null = null;
  try {
    mkdirSync(lockDir);
    recreate = setInterval(() => {
      try {
        rmSync(lockDir, { recursive: true, force: true });
        mkdirSync(lockDir);
      } catch {
        // best-effort flapping; a missed tick is fine
      }
    }, 10);

    const timeoutMs = 300;
    const started = Date.now();
    await assert.rejects(
      () => withRegistryLock(path, () => "should not run", timeoutMs),
      RegistryLockTimeoutError,
    );
    const elapsed = Date.now() - started;
    // Generous slack (5x) for CI jitter; a regression to the old bug would
    // blow past this by orders of magnitude (it would still be running
    // when the whole test file's timeout kills it), not by a little.
    assert.ok(elapsed < timeoutMs * 5, `expected termination within ~${timeoutMs * 5}ms, took ${elapsed}ms`);
  } finally {
    if (recreate) clearInterval(recreate);
    rmSync(path, { force: true });
    rmSync(lockDir, { recursive: true, force: true });
  }
});
