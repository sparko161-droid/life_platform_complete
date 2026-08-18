import { readFileSync, writeFileSync } from "node:fs";
import { dump, load } from "js-yaml";
import { registrySchema, taskSchema, type Registry, type Task } from "./schema.js";

export class RegistryError extends Error {}

export function loadRegistry(filePath: string): Registry {
  const raw = load(readFileSync(filePath, "utf8"));
  const parsed = registrySchema.safeParse(raw);
  if (!parsed.success) {
    throw new RegistryError(
      `Invalid registry at ${filePath}: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  return parsed.data;
}

export function saveRegistry(filePath: string, registry: Registry): void {
  const validated = registrySchema.parse(registry);
  const yamlText = dump(validated, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  });
  writeFileSync(filePath, yamlText, "utf8");
}

export function findTask(registry: Registry, id: string): Task {
  const task = registry.tasks.find((t) => t.id === id);
  if (!task) throw new RegistryError(`Unknown task id: ${id}`);
  return task;
}

export function replaceTask(registry: Registry, updated: Task): Registry {
  taskSchema.parse(updated);
  return {
    ...registry,
    tasks: registry.tasks.map((t) => (t.id === updated.id ? updated : t)),
  };
}

/**
 * Structural validation beyond per-field schema checks:
 * - every dependency id must exist
 * - the dependency graph must be acyclic
 * - at most one task may be IN_PROGRESS under a given primary at a time is
 *   NOT globally enforced here (an agent may legitimately run one active
 *   task); single-primary-executor is enforced per-task at claim time
 *   instead (see claimTask in cli.ts), matching
 *   docs/implementations/phase-0-task-registry.md.
 */
export function validateStructure(registry: Registry): string[] {
  const problems: string[] = [];
  const ids = new Set(registry.tasks.map((t) => t.id));

  for (const task of registry.tasks) {
    for (const dep of task.deps) {
      if (!ids.has(dep)) {
        problems.push(`${task.id}: unknown dependency ${dep}`);
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byId = new Map(registry.tasks.map((t) => [t.id, t]));

  function visit(id: string, path: string[]): void {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      problems.push(`Dependency cycle: ${[...path, id].join(" -> ")}`);
      return;
    }
    visiting.add(id);
    const task = byId.get(id);
    if (task) {
      for (const dep of task.deps) visit(dep, [...path, id]);
    }
    visiting.delete(id);
    visited.add(id);
  }

  for (const task of registry.tasks) visit(task.id, []);

  return problems;
}

/**
 * Tasks an agent could `claim` right now: READY, with every dependency
 * DONE, optionally narrowed to one role. Sorted by phase then id so an
 * orchestrator (or a human) picking "what's next" gets a stable order
 * instead of registry file order (P0-011).
 */
export function claimableTasks(registry: Registry, opts: { role?: string } = {}): Task[] {
  const byId = new Map(registry.tasks.map((t) => [t.id, t]));
  return registry.tasks
    .filter((t) => {
      if (t.status !== "READY") return false;
      if (opts.role && t.primary !== opts.role) return false;
      return t.deps.every((depId) => byId.get(depId)?.status === "DONE");
    })
    .sort((a, b) => a.phase - b.phase || a.id.localeCompare(b.id));
}

export interface OutstandingDecision {
  taskId: string;
  kind: "blocked" | "human_decision" | "blocking_discovery";
  summary: string;
}

/**
 * Implements docs/planning/phases/phase-0.md's exit criterion "Human
 * Architect sees only unresolved decisions" (P0-012): everything in the
 * registry that genuinely needs a human's attention, and nothing else --
 * not the 43 PLANNED tasks, not the ones quietly moving through gates.
 *
 * Three sources, each already tracked on Task but never surfaced together:
 * - a *_BLOCKED status (blocked_reason names why)
 * - a human_decisions entry whose `decision` is still null
 * - a discovery_links entry marked `blocking`
 */
export function outstandingDecisions(registry: Registry): OutstandingDecision[] {
  const out: OutstandingDecision[] = [];
  for (const t of registry.tasks) {
    if (t.status.endsWith("_BLOCKED")) {
      out.push({
        taskId: t.id,
        kind: "blocked",
        summary: `${t.status}: ${t.blocked_reason ?? "(no reason recorded)"}`,
      });
    }
    for (const hd of t.human_decisions) {
      if (hd.decision === null) {
        out.push({ taskId: t.id, kind: "human_decision", summary: hd.question });
      }
    }
    for (const dl of t.discovery_links) {
      if (dl.blocking) {
        out.push({
          taskId: t.id,
          kind: "blocking_discovery",
          summary: `${dl.discovery_id}: ${dl.finding}`,
        });
      }
    }
  }
  return out;
}
