import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { basename, resolve } from "node:path";
import type { Task } from "./schema.js";

const run = promisify(execFile);

/** @public Thrown by worktree operations; catch-able by callers that import this module. */
export class WorktreeError extends Error {}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .split("-")
    .slice(0, 5)
    .join("-");
}

/**
 * Branch naming convention from AGENTS.md: `agent/<role>/<task-id>-<slug>`.
 * Worktree path convention: a sibling directory `<repo-name>-wt/<task-id>`,
 * matching docs/implementations/phase-0-agent-worktrees.md ("one task = one
 * branch/worktree").
 */
export function branchName(task: Task, role: string, slug?: string): string {
  return `agent/${role}/${task.id}-${slug ?? slugify(task.title)}`;
}

/**
 * Resolves the *main* repository root, not the current worktree's root.
 * `git rev-parse --show-toplevel` returns the linked worktree's own
 * directory when run from inside one, which would nest new worktrees
 * under the worktree that created them instead of alongside the main
 * repo. `--git-common-dir` always points at the shared `.git` in the
 * main repo, so its parent is the stable anchor for the sibling
 * `<repo-name>-wt/` convention regardless of which worktree this runs from.
 */
export async function repoRoot(): Promise<string> {
  const { stdout } = await run("git", [
    "rev-parse",
    "--path-format=absolute",
    "--git-common-dir",
  ]);
  const gitDir = stdout.trim();
  return resolve(gitDir, "..");
}

/** @public Resolves the worktree path for a task; used by the worktree create sub-command and future CI tooling. */
export async function worktreePath(task: Task): Promise<string> {
  const root = await repoRoot();
  const repoName = basename(root);
  return resolve(root, "..", `${repoName}-wt`, task.id);
}

export async function createWorktree(
  task: Task,
  opts: { role: string; slug?: string; from?: string },
): Promise<{ branch: string; path: string }> {
  const branch = branchName(task, opts.role, opts.slug);
  const path = await worktreePath(task);
  const from = opts.from ?? "main";
  try {
    await run("git", ["worktree", "add", "-b", branch, path, from]);
  } catch (err) {
    throw new WorktreeError(
      `git worktree add failed for ${task.id} (branch ${branch} from ${from}): ${
        err instanceof Error ? err.message : err
      }`,
    );
  }
  return { branch, path };
}

async function isMergedIntoMain(branch: string): Promise<boolean> {
  const { stdout } = await run("git", ["branch", "--merged", "main"]);
  return stdout
    .split("\n")
    .map((l) => l.replace(/^\*?\s*/, "").trim())
    .includes(branch);
}

export async function removeWorktree(
  task: Task,
  opts: { branch?: string; force?: boolean },
): Promise<void> {
  const path = await worktreePath(task);

  if (opts.branch && !opts.force) {
    const merged = await isMergedIntoMain(opts.branch);
    if (!merged) {
      throw new WorktreeError(
        `Refusing to remove worktree for ${task.id}: branch "${opts.branch}" is not merged ` +
          `into main yet. Pass --force to remove anyway (matches ` +
          `docs/implementations/phase-0-agent-worktrees.md: "Worktree is removed only after ` +
          `merge and artifact retention").`,
      );
    }
  }

  const args = ["worktree", "remove", path];
  if (opts.force) args.push("--force");
  try {
    await run("git", args);
  } catch (err) {
    throw new WorktreeError(
      `git worktree remove failed for ${task.id} at ${path}: ${
        err instanceof Error ? err.message : err
      }`,
    );
  }
}
