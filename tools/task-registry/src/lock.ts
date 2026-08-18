import { existsSync, mkdirSync, rmdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Mutual exclusion for tasks/registry.yaml (P0-011).
 *
 * loadRegistry()/saveRegistry() are plain synchronous read-then-write with
 * no locking, which is fine for one agent at a time but not for the thing
 * this whole repo is built around: multiple AI agents running task-registry
 * commands concurrently from separate worktrees. Two concurrent `claim`
 * calls on the same task both read READY, both write IN_PROGRESS, and both
 * report success -- silently violating "every task has one primary
 * executor" (docs/ai-team/task-lifecycle.md). Reproduced this for real
 * before writing this fix (two Node processes racing `claim` on the same
 * scratch registry both "succeeded").
 *
 * `mkdir` is atomic on both POSIX and NTFS, so a lock directory next to the
 * registry file is a real mutex, not a best-effort convention.
 */

const DEFAULT_TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 50;
const STALE_LOCK_MS = 30_000; // generous: covers a slow claim+worktree-create, not a crashed process holding it forever
const INFO_FILE = "info";

export class RegistryLockTimeoutError extends Error {}

function lockPath(registryPath: string): string {
  return resolve(registryPath, "..", `.${registryPath.split(/[\\/]/).pop()}.lock`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// fs.rmSync's recursive removal (`{ recursive: true }`) was found to return
// without throwing yet silently leave the directory in place, reproduced
// both through this CLI's own commands and in a bare isolated Node script
// with no tsx/CLI involvement at all. The one variable that mattered: this
// repo's path contains Cyrillic characters
// (...\Desktop\Работа\antigravity\...). An ASCII sibling path removed
// cleanly every time; the Cyrillic one silently failed every time,
// regardless of retry count or backoff. The plain non-recursive syscalls
// rmSync composes internally -- unlink the one file, then rmdir the now-
// empty directory -- worked correctly on the same Cyrillic path in the same
// script, so this lock dir (which only ever holds one `info` file) uses
// those directly instead of the recursive helper.
function removeLockDir(lock: string): void {
  try {
    unlinkSync(resolve(lock, INFO_FILE));
  } catch {
    // no info file, or already gone -- fine, rmdirSync below is what matters
  }
  try {
    rmdirSync(lock);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

async function acquire(registryPath: string, timeoutMs: number): Promise<string> {
  const lock = lockPath(registryPath);
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    try {
      mkdirSync(lock);
      writeFileSync(resolve(lock, INFO_FILE), `pid=${process.pid} at=${new Date().toISOString()}\n`, "utf8");
      return lock;
    } catch (err) {
      const isExists = (err as NodeJS.ErrnoException).code === "EEXIST";
      if (!isExists) throw err;
    }

    // Someone else (or a crashed process) holds the lock. Try to recover a
    // stale one -- a crashed process could otherwise leave the directory
    // behind forever -- but every branch below falls through to the same
    // deadline check and sleep. An earlier version `continue`d straight
    // back to the top from the stale-recovery and stat-failure branches,
    // skipping both; if a removal doesn't take effect immediately for any
    // reason, that turned into an unbounded busy loop that pegged a CPU
    // core and never reached the timeout -- reproduced for real, not just
    // theorized, before this fix.
    try {
      const age = Date.now() - statSync(lock).mtimeMs;
      if (age > STALE_LOCK_MS) {
        removeLockDir(lock);
      }
    } catch {
      // Lock disappeared between the failed mkdir and this stat -- fine,
      // the next mkdirSync will simply succeed.
    }

    if (Date.now() > deadline) {
      throw new RegistryLockTimeoutError(
        `Timed out waiting for ${lock} after ${timeoutMs}ms. ` +
          `Another task-registry command may be running concurrently. ` +
          `If you're sure nothing else is running, remove ${lock} by hand.`,
      );
    }
    await sleep(RETRY_DELAY_MS);
  }
}

// Verify-and-retry even though removeLockDir uses the syscalls proven to
// work on this repo's path -- cheap insurance against a genuinely transient
// hold (e.g. antivirus briefly scanning the just-written info file) that
// the Cyrillic-path investigation above ruled out as the *root* cause here
// but doesn't rule out everywhere this tool might run.
async function release(lock: string): Promise<void> {
  const maxAttempts = 6;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      removeLockDir(lock);
    } catch {
      // fall through to the existence check below and retry
    }
    if (!existsSync(lock)) return;
    if (attempt < maxAttempts) await sleep(20 * attempt);
  }
  // The registry mutation this lock was protecting already happened and
  // was saved -- only the *next* command's wait time is affected, so warn
  // rather than throwing out of an otherwise-successful command.
  console.error(
    `Warning: could not confirm removal of lock directory ${lock} after ${maxAttempts} attempts. ` +
      `It will be auto-recovered as stale by the next command after ${STALE_LOCK_MS}ms, or remove it by hand.`,
  );
}

export async function withRegistryLock<T>(
  registryPath: string,
  fn: () => T | Promise<T>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const lock = await acquire(registryPath, timeoutMs);
  try {
    return await fn();
  } finally {
    await release(lock);
  }
}
