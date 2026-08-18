#!/usr/bin/env node
import { Command } from "commander";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  claimableTasks,
  findTask,
  loadRegistry,
  outstandingDecisions,
  replaceTask,
  saveRegistry,
  startBlockingDependencies,
  validateStructure,
} from "./registry.js";
import {
  allowedNextStates,
  integrationProblems,
  readyAdmissionProblems,
  isValidTransition,
  type Task,
  type TaskState,
} from "./schema.js";
import { renderHandoff } from "./handoff.js";
import { createWorktree, removeWorktree, repoRoot } from "./worktree.js";
import { loadContractRegistry, validateContractRegistry } from "./contracts.js";
import { validateControlPlane } from "./control.js";
import { withRegistryLock } from "./lock.js";

// pnpm --filter runs scripts with cwd set to the package directory, not the
// repo root the CLI is meant to operate from. pnpm sets INIT_CWD to the
// directory the command was originally invoked from, so prefer that.
const invocationCwd = process.env.INIT_CWD ?? process.cwd();
const DEFAULT_REGISTRY_PATH = resolve(invocationCwd, "tasks/registry.yaml");

// Handoff reports are archived next to the registry (tasks/handoffs/<id>.md)
// so a review can be reconstructed later instead of relying on whoever ran
// the command having kept their terminal scrollback (P0-010).
function handoffArchivePath(registryPath: string, id: string): string {
  return resolve(dirname(registryPath), "handoffs", `${id}.md`);
}

function registryPath(opts: { registry?: string }): string {
  return opts.registry ? resolve(invocationCwd, opts.registry) : DEFAULT_REGISTRY_PATH;
}

// Dependencies are printed by class, not as one flat list, because the two
// classes gate different things (start vs integrate) -- collapsing them
// back into `deps=[...]` in the human-facing output would hide exactly the
// distinction BLK-P1-003 introduced.
function describeDeps(task: Task): string {
  const parts = [`contract=[${task.deps_contract.join(",")}]`, `impl=[${task.deps_implementation.join(",")}]`];
  if (task.deps.length > 0) parts.push(`unclassified=[${task.deps.join(",")}]`);
  return parts.join(" ");
}

function transition(task: Task, to: TaskState): Task {
  if (!isValidTransition(task.status as TaskState, to)) {
    const allowed = allowedNextStates(task.status as TaskState);
    throw new Error(
      `Invalid transition ${task.status} -> ${to} for ${task.id}. Allowed: ${
        allowed.length ? allowed.join(", ") : "(terminal state)"
      }`,
    );
  }
  return { ...task, status: to };
}

const program = new Command();
program
  .name("task-registry")
  .description("Source-controlled task registry lifecycle CLI (tasks/registry.yaml)")
  .option("-r, --registry <path>", "path to registry.yaml (default tasks/registry.yaml)");

program
  .command("list")
  .description("list tasks, optionally filtered")
  .option("--status <status>")
  .option("--phase <phase>")
  .option("--primary <agent>")
  .action((cmdOpts, cmd) => {
    const path = registryPath(cmd.optsWithGlobals());
    const registry = loadRegistry(path);
    const rows = registry.tasks.filter((t) => {
      if (cmdOpts.status && t.status !== cmdOpts.status) return false;
      if (cmdOpts.phase && String(t.phase) !== String(cmdOpts.phase)) return false;
      if (cmdOpts.primary && t.primary !== cmdOpts.primary) return false;
      return true;
    });
    for (const t of rows) {
      console.log(
        `${t.id}\t${t.status}\t${t.primary}\t${t.reviewer ?? "-"}\t${describeDeps(t)}\t${t.title}`,
      );
    }
    console.log(`\n${rows.length} task(s)`);
  });

program
  .command("next")
  .description("list tasks an agent could claim right now (READY with every contract dep DONE), sorted by phase then id")
  .option("--role <role>", "only tasks whose primary matches this role")
  .option("--limit <n>", "cap the number of results", "20")
  .action((cmdOpts, cmd) => {
    const path = registryPath(cmd.optsWithGlobals());
    const registry = loadRegistry(path);

    const claimable = claimableTasks(registry, { role: cmdOpts.role });
    const limited = claimable.slice(0, Number(cmdOpts.limit));

    if (limited.length === 0) {
      console.log("Nothing claimable right now (no READY task has every contract dependency DONE" + (cmdOpts.role ? ` for role ${cmdOpts.role}` : "") + ").");
      return;
    }
    for (const t of limited) {
      console.log(`${t.id}\tphase=${t.phase}\t${t.primary}\t${describeDeps(t)}\t${t.title}`);
    }
    console.log(`\n${limited.length} of ${claimable.length} claimable task(s) shown.`);
  });

program
  .command("decisions")
  .description("everything that needs a human's attention -- blocked tasks, unresolved human_decisions, blocking discoveries -- and nothing else")
  .action((_opts, cmd) => {
    const path = registryPath(cmd.optsWithGlobals());
    const registry = loadRegistry(path);
    const items = outstandingDecisions(registry);

    if (items.length === 0) {
      console.log("No outstanding decisions. Nothing needs Human Architect attention right now.");
      return;
    }
    const labels: Record<(typeof items)[number]["kind"], string> = {
      blocked: "BLOCKED",
      human_decision: "DECISION",
      blocking_discovery: "DISCOVERY",
    };
    for (const item of items) {
      console.log(`${item.taskId}\t${labels[item.kind]}\t${item.summary}`);
    }
    console.log(`\n${items.length} item(s) need a decision.`);
  });

program
  .command("validate")
  .description("validate registry structure: schema, unknown deps, cycles")
  .action((_opts, cmd) => {
    const path = registryPath(cmd.optsWithGlobals());
    const registry = loadRegistry(path); // throws on schema violations
    const problems = validateStructure(registry);
    if (problems.length > 0) {
      console.error("Registry validation FAILED:");
      for (const p of problems) console.error(`  - ${p}`);
      process.exitCode = 1;
      return;
    }
    console.log(`Registry OK: ${registry.tasks.length} tasks, schema + graph valid.`);
  });

program
  .command("admit <id>")
  .description("admit a task to READY, enforcing docs/governance/task-admission.md")
  .action(async (id: string, _cmdOpts, cmd) => {
    const path = registryPath(cmd.optsWithGlobals());
    await withRegistryLock(path, () => {
      const registry = loadRegistry(path);
      const task = findTask(registry, id);

      // The admission rules are checked *before* the transition, so a task
      // can never sit at READY in a state readyAdmissionProblems() would
      // reject -- which is what `validate` and the dashboard both assume.
      const problems = readyAdmissionProblems(task);
      if (problems.length > 0) {
        throw new Error(
          `${id} cannot be admitted to READY:\n  - ${problems.join("\n  - ")}`,
        );
      }

      const admitted = transition(task, "READY");
      saveRegistry(path, replaceTask(registry, admitted));
      console.log(`${id} admitted: ${task.status} -> READY`);
    });
  });

program
  .command("claim <id>")
  .description("claim a READY/BACKLOG task as its single primary executor")
  .requiredOption("--agent <role>", "agent/role claiming the task")
  .action(async (id: string, cmdOpts, cmd) => {
    const path = registryPath(cmd.optsWithGlobals());
    await withRegistryLock(path, () => {
      const registry = loadRegistry(path);
      const task = findTask(registry, id);

      // Only start-blocking dependencies (contract + still-unclassified)
      // are checked here. An open implementation dependency is allowed to
      // start -- docs/governance/task-admission.md permits building
      // against a frozen contract in parallel -- and is caught at handoff
      // instead.
      for (const dep of startBlockingDependencies(task)) {
        const depTask = findTask(registry, dep);
        if (depTask.status !== "DONE") {
          throw new Error(
            `${id} cannot be claimed: contract dependency ${dep} is ${depTask.status}, not DONE.`,
          );
        }
      }

      if (task.status === "IN_PROGRESS") {
        throw new Error(
          `${id} is already IN_PROGRESS under primary "${task.primary}". ` +
            `Single-primary-executor rule: reassign or wait for handoff/close first.`,
        );
      }

      const claimed = transition({ ...task, primary: cmdOpts.agent }, "IN_PROGRESS");
      saveRegistry(path, replaceTask(registry, claimed));
      console.log(`${id} claimed by ${cmdOpts.agent}. status=IN_PROGRESS`);
    });
  });

program
  .command("handoff <id>")
  .description("move a claimed task to REVIEW and print the fixed handoff report")
  .requiredOption("--reviewer <role>")
  .option("--gate-owners <roles>", "comma-separated gate owners")
  .option("--branch <branch>")
  .option("--files <items>", "comma-separated changed files")
  .option("--contracts <items>", "comma-separated changed contracts")
  .option("--tests <items>", "comma-separated tests run")
  .option("--risks <items>", "comma-separated known risks")
  .option("--decisions <items>", "comma-separated decisions made")
  .option("--next <items>", "comma-separated follow-up task ids/notes")
  .action(async (id: string, cmdOpts, cmd) => {
    const path = registryPath(cmd.optsWithGlobals());
    await withRegistryLock(path, () => {
      const registry = loadRegistry(path);
      const task = findTask(registry, id);
      const split = (v?: string) => (v ? v.split(",").map((s: string) => s.trim()).filter(Boolean) : []);

      // docs/governance/task-admission.md: a task may be built against a
      // frozen contract, but may not be integrated while an
      // implementation dependency is unfinished. REVIEW is where the work
      // is offered for merge, so that is where the rule is enforced.
      const statusById = new Map(registry.tasks.map((t) => [t.id, t.status as TaskState]));
      const integration = integrationProblems(task, (depId) => statusById.get(depId));
      if (integration.length > 0) {
        throw new Error(
          `${id} cannot be handed off for integration:\n  - ${integration.join("\n  - ")}\n` +
            `Keep it IN_PROGRESS, or reclassify the dependency if it is really only a contract dependency.`,
        );
      }

      const updated = transition(
        {
          ...task,
          reviewer: cmdOpts.reviewer,
          gate_owners: split(cmdOpts.gateOwners),
        },
        "REVIEW",
      );
      saveRegistry(path, replaceTask(registry, updated));

      const report = renderHandoff({
        task: updated,
        branch: cmdOpts.branch ?? null,
        files: split(cmdOpts.files),
        contracts: split(cmdOpts.contracts),
        tests: split(cmdOpts.tests),
        risks: split(cmdOpts.risks),
        decisions: split(cmdOpts.decisions),
        nextTasks: split(cmdOpts.next),
      });
      const archivePath = handoffArchivePath(path, id);
      mkdirSync(dirname(archivePath), { recursive: true });
      writeFileSync(archivePath, report.endsWith("\n") ? report : `${report}\n`, "utf8");

      console.log(report);
      console.log(`\n(archived to ${archivePath})`);
    });
  });

program
  .command("block <id>")
  .description("mark a task blocked")
  .requiredOption("--type <type>", "architecture|product|security|dependency")
  .requiredOption("--reason <reason>")
  .action(async (id: string, cmdOpts, cmd) => {
    const path = registryPath(cmd.optsWithGlobals());
    await withRegistryLock(path, () => {
      const registry = loadRegistry(path);
      const task = findTask(registry, id);
      const stateByType: Record<string, TaskState> = {
        architecture: "ARCHITECTURE_BLOCKED",
        product: "PRODUCT_BLOCKED",
        security: "SECURITY_BLOCKED",
        dependency: "DEPENDENCY_BLOCKED",
      };
      const target = stateByType[cmdOpts.type];
      if (!target) throw new Error(`Unknown block type: ${cmdOpts.type}`);
      const updated = transition({ ...task, blocked_reason: cmdOpts.reason }, target);
      saveRegistry(path, replaceTask(registry, updated));
      console.log(`${id} blocked: ${target} (${cmdOpts.reason})`);
    });
  });

program
  .command("unblock <id>")
  .description("resume a blocked task")
  .requiredOption("--status <status>", "target state, e.g. IN_PROGRESS or READY")
  .action(async (id: string, cmdOpts, cmd) => {
    const path = registryPath(cmd.optsWithGlobals());
    await withRegistryLock(path, () => {
      const registry = loadRegistry(path);
      const task = findTask(registry, id);
      const updated = transition({ ...task, blocked_reason: null }, cmdOpts.status as TaskState);
      saveRegistry(path, replaceTask(registry, updated));
      console.log(`${id} unblocked -> ${cmdOpts.status}`);
    });
  });

program
  .command("reassign <id>")
  .description("change the primary executor without changing status")
  .requiredOption("--agent <role>")
  .action(async (id: string, cmdOpts, cmd) => {
    const path = registryPath(cmd.optsWithGlobals());
    await withRegistryLock(path, () => {
      const registry = loadRegistry(path);
      const task = findTask(registry, id);
      saveRegistry(path, replaceTask(registry, { ...task, primary: cmdOpts.agent }));
      console.log(`${id} reassigned: primary=${cmdOpts.agent}`);
    });
  });

program
  .command("add-discovery <id>")
  .description("attach a discovery to a task under review")
  .requiredOption("--type <type>")
  .requiredOption("--finding <text>")
  .requiredOption("--why <text>")
  .requiredOption("--priority <priority>", "LOW|MEDIUM|HIGH|CRITICAL")
  .option("--blocking", "mark the discovery as blocking", false)
  .option("--proposed-task <id>")
  .action(async (id: string, cmdOpts, cmd) => {
    const path = registryPath(cmd.optsWithGlobals());
    await withRegistryLock(path, () => {
      const registry = loadRegistry(path);
      const task = findTask(registry, id);
      const discoveryId = `DISC-${task.id}-${task.discovery_links.length + 1}`;
      const discovery = {
        discovery_id: discoveryId,
        source_task: task.id,
        type: cmdOpts.type,
        finding: cmdOpts.finding,
        why_it_matters: cmdOpts.why,
        affected_domains: [],
        architecture_impact: null,
        security_impact: null,
        ux_impact: null,
        recommended_solution: null,
        alternatives: [],
        priority: cmdOpts.priority,
        blocking: Boolean(cmdOpts.blocking),
        proposed_task: cmdOpts.proposedTask ?? null,
      };
      const updated = {
        ...task,
        discovery_links: [...task.discovery_links, discovery],
      };
      saveRegistry(path, replaceTask(registry, updated));
      console.log(`Discovery ${discoveryId} added to ${id}.`);
    });
  });

program
  .command("create-child-task")
  .description("create a new task from a triaged discovery, preserving traceability")
  .requiredOption("--from-discovery <discoveryId>")
  .requiredOption("--id <newId>")
  .requiredOption("--title <title>")
  .requiredOption("--primary <role>")
  .requiredOption("--phase <phase>")
  .option("--deps <items>", "comma-separated dependency ids", "")
  .action(async (cmdOpts, cmd) => {
    const path = registryPath(cmd.optsWithGlobals());
    await withRegistryLock(path, () => {
      const registry = loadRegistry(path);

      if (registry.tasks.some((t) => t.id === cmdOpts.id)) {
        throw new Error(`Task ${cmdOpts.id} already exists.`);
      }

      const source = registry.tasks.find((t) =>
        t.discovery_links.some((d) => d.discovery_id === cmdOpts.fromDiscovery),
      );
      if (!source) {
        throw new Error(`No task holds discovery ${cmdOpts.fromDiscovery}.`);
      }

      const newTask: Task = {
        id: cmdOpts.id,
        phase: Number(cmdOpts.phase),
        title: cmdOpts.title,
        primary: cmdOpts.primary,
        status: "BACKLOG",
        deps: [],
        // A new task's dependencies default to the strictest class:
        // implementation. Classifying one down to `deps_contract` is a
        // deliberate act (the upstream contract really is frozen), not
        // something a CLI default should decide.
        deps_contract: [],
        deps_implementation: cmdOpts.deps
          ? cmdOpts.deps.split(",").map((s: string) => s.trim()).filter(Boolean)
          : [],
        reviewer: null,
        gate_owners: [],
        discovery_links: [],
        blocked_reason: null,
        human_decisions: [],
        origin_discovery: cmdOpts.fromDiscovery,
        discovered_from: source.id,
        execution: {
          wave: "UNASSIGNED",
          priority: "P2",
          acceptance_criteria: "",
          test_strategy: "",
          source_reference: `discovery:${cmdOpts.fromDiscovery}`,
        },
      };

      saveRegistry(path, { ...registry, tasks: [...registry.tasks, newTask] });
      console.log(
        `${newTask.id} created from ${cmdOpts.fromDiscovery} (discovered_from=${source.id}).`,
      );
    });
  });

program
  .command("close <id>")
  .description("close a task (default: -> DONE)")
  .option("--status <status>", "DONE or NEW_TASK", "DONE")
  .action(async (id: string, cmdOpts, cmd) => {
    const path = registryPath(cmd.optsWithGlobals());
    await withRegistryLock(path, () => {
      const registry = loadRegistry(path);
      const task = findTask(registry, id);
      const updated = transition(task, cmdOpts.status as TaskState);
      saveRegistry(path, replaceTask(registry, updated));
      console.log(`${id} closed -> ${cmdOpts.status}`);
    });
  });

const worktree = program.command("worktree").description("git worktree per task, per AGENTS.md branch naming");

worktree
  .command("create <id>")
  .description("create a worktree + branch agent/<role>/<id>-<slug> for a task")
  .requiredOption("--role <role>")
  .option("--slug <slug>", "override the derived slug")
  .option("--from <branch>", "base branch/ref", "main")
  .action(async (id: string, cmdOpts, cmd) => {
    const path = registryPath(cmd.optsWithGlobals());
    const registry = loadRegistry(path);
    const task = findTask(registry, id);
    const result = await createWorktree(task, {
      role: cmdOpts.role,
      slug: cmdOpts.slug,
      from: cmdOpts.from,
    });
    console.log(`Created worktree for ${id}:`);
    console.log(`  branch: ${result.branch}`);
    console.log(`  path:   ${result.path}`);
  });

worktree
  .command("remove <id>")
  .description("remove a task's worktree (refuses if its branch isn't merged into main, unless --force)")
  .option("--branch <branch>", "branch to check for merge status before removing")
  .option("--force", "remove even if unmerged", false)
  .action(async (id: string, cmdOpts, cmd) => {
    const path = registryPath(cmd.optsWithGlobals());
    const registry = loadRegistry(path);
    const task = findTask(registry, id);
    await removeWorktree(task, { branch: cmdOpts.branch, force: Boolean(cmdOpts.force) });
    console.log(`Removed worktree for ${id}.`);
  });

const contracts = program.command("contracts").description("contracts/registry.yaml (P0-010)");

contracts
  .command("validate")
  .description("check contracts/registry.yaml against domain-types exports, task ids and change-log headings")
  .option("--file <path>", "path to contracts/registry.yaml", "contracts/registry.yaml")
  .action(async (cmdOpts, cmd) => {
    const regPath = registryPath(cmd.optsWithGlobals());
    const root = await repoRoot();

    const taskRegistry = loadRegistry(regPath);
    const contractsPath = resolve(root, cmdOpts.file);
    const contractRegistry = loadContractRegistry(contractsPath);

    const problems = validateContractRegistry(contractRegistry, {
      repoRoot: root,
      taskRegistry,
      changelogPath: resolve(root, "docs/planning/change-log.md"),
      domainTypesSrcDir: "packages/domain-types/src",
      orphanScanExclude: ["index.ts", "ids.ts", "classification.ts"],
    });

    if (problems.length > 0) {
      console.error(`Contract registry validation FAILED (${contractsPath}):`);
      for (const p of problems) console.error(`  - ${p}`);
      process.exitCode = 1;
      return;
    }
    console.log(
      `Contract registry OK: ${contractRegistry.groups.length} group(s), pack version ${contractRegistry.contract_pack_version}.`,
    );
  });

const control = program
  .command("control")
  .description("Wave Gate / Architecture Control review artifacts (P1-020)");

control
  .command("validate")
  .description("check tasks/reviews/*.yaml against wave status, task status and open blockers")
  .option("--reviews <dir>", "directory holding review artifacts", "tasks/reviews")
  .option("--phase-status <path>", "phase/wave status file", "tasks/phase-1-status.yaml")
  .option("--blockers <path>", "blockers file", "tasks/phase-1-blockers.yaml")
  .action(async (cmdOpts, cmd) => {
    const root = await repoRoot();
    const taskRegistry = loadRegistry(registryPath(cmd.optsWithGlobals()));

    const problems = validateControlPlane({
      reviewsDir: resolve(root, cmdOpts.reviews),
      phaseStatusPath: resolve(root, cmdOpts.phaseStatus),
      blockersPath: resolve(root, cmdOpts.blockers),
      taskRegistry,
    });

    if (problems.length > 0) {
      console.error("Control-plane validation FAILED:");
      for (const p of problems) console.error(`  - ${p}`);
      process.exitCode = 1;
      return;
    }
    console.log("Control plane OK: review artifacts agree with wave status, task status and open blockers.");
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
