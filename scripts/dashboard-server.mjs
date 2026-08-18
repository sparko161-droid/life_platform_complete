#!/usr/bin/env node
// Persistent local dashboard server for tasks/registry.yaml.
//
// `pnpm run dashboard` serves the task board and a separate control view:
//   /                    task board (scripts/dashboard/index.html)
//   /control.html        Phase/Wave/Architecture Control (P1-020, reconciled
//                         from agent/phase-1-execution-governance)
//   /api/registry.json    raw task registry
//   /api/control.json     task counts + phase/wave gate status + admission
//                         violations + open blockers
//   /events                live registry-change SSE (also fires on the
//                         three phase-1-*.yaml control files)
//
// Deliberately plain `node:http` + `fs.watch`, no framework and no new
// runtime dependency beyond `js-yaml` (already a root devDependency) --
// this is a single-user local tool, not a service.
//
// /api/control.json reuses `readyAdmissionProblems()` from
// tools/task-registry (built output) rather than re-implementing the
// admission rules here -- one source of truth for "what makes a READY task
// valid." Run `pnpm build` (or `pnpm --filter @life/tools-task-registry
// run build`) at least once before starting this server.

import { createReadStream, existsSync, readFileSync, statSync, watch } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";
import { readyAdmissionProblems } from "../tools/task-registry/dist/schema.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dashboardDir = resolve(repoRoot, "scripts/dashboard");
const registryPath = resolve(repoRoot, "tasks/registry.yaml");
const phaseStatusPath = resolve(repoRoot, "tasks/phase-1-status.yaml");
const blockersPath = resolve(repoRoot, "tasks/phase-1-blockers.yaml");
const matrixPath = resolve(repoRoot, "tasks/phase-1-participant-matrix.yaml");
const PORT = Number(process.env.DASHBOARD_PORT || 4747);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".woff2": "font/woff2",
  ".json": "application/json; charset=utf-8",
};

function readYaml(path) {
  return load(readFileSync(path, "utf8"));
}

function readRegistry() {
  return readYaml(registryPath);
}

function readControl() {
  const registry = readRegistry();
  const phaseStatus = readYaml(phaseStatusPath);
  const blockersDoc = readYaml(blockersPath);
  const tasks = registry.tasks ?? [];

  const blocked = tasks.filter((t) => String(t.status).endsWith("_BLOCKED"));
  const reviewStatuses = new Set(["REVIEW", "QA", "SECURITY", "ACCEPTANCE"]);
  const review = tasks.filter((t) => reviewStatuses.has(t.status));
  const done = tasks.filter((t) => t.status === "DONE");

  // Single source of truth: the same readyAdmissionProblems() task-registry
  // itself runs in `validate`/`claim`, not a re-implementation with its own
  // (possibly drifted) rules.
  const violations = [];
  for (const t of tasks) {
    if (t.status !== "READY") continue;
    for (const message of readyAdmissionProblems(t)) {
      violations.push({ id: t.id, type: "ADMISSION", message });
    }
  }

  return {
    registryVersion: registry.version,
    tasks: { total: tasks.length, done: done.length, review: review.length, blocked: blocked.length },
    phase: phaseStatus.phase,
    waves: phaseStatus.waves ?? [],
    blockers: (blockersDoc.blockers ?? []).filter((b) => b.status === "OPEN"),
    violations,
  };
}

// SSE clients currently connected. A Set, not a single value, because
// several browser tabs (or the same tab across reloads) can be open at once.
const sseClients = new Set();

function broadcastChange() {
  const payload = `event: registry-changed\ndata: ${Date.now()}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch {
      sseClients.delete(res);
    }
  }
}

// fs.watch fires more than once per logical save on some platforms
// (editors, and task-registry's own write-then-rename-free plain
// writeFileSync can still trigger duplicate "change" events). Debounce so
// one `task-registry claim` command doesn't fire the SSE event three times.
let debounceTimer = null;
function onRegistryFileEvent() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(broadcastChange, 150);
}

function serveStatic(req, res, filePath) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
    return;
  }
  const ext = extname(filePath);
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  createReadStream(filePath).pipe(res);
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/api/registry.json") {
    try {
      res.writeHead(200, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
      res.end(JSON.stringify(readRegistry()));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end(`Failed to read tasks/registry.yaml: ${err instanceof Error ? err.message : String(err)}`);
    }
    return;
  }

  if (url.pathname === "/api/control.json") {
    try {
      res.writeHead(200, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
      res.end(JSON.stringify(readControl()));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end(`Failed to read control-plane state: ${err instanceof Error ? err.message : String(err)}`);
    }
    return;
  }

  if (url.pathname === "/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write(": connected\n\n");
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
    return;
  }

  if (url.pathname === "/healthz") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }

  const fsPath = url.pathname === "/" ? "/index.html" : url.pathname;
  // Prevent path traversal outside scripts/dashboard/ -- this is a local
  // tool, but it still binds a real TCP port, so don't hand out arbitrary
  // filesystem reads.
  const resolved = resolve(dashboardDir, `.${fsPath}`);
  if (!resolved.startsWith(dashboardDir)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Forbidden");
    return;
  }
  serveStatic(req, res, resolved);
});

for (const watchedPath of [registryPath, phaseStatusPath, blockersPath, matrixPath]) {
  watch(watchedPath, { persistent: true }, onRegistryFileEvent);
}

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Dashboard: http://localhost:${PORT}/`);
  console.log(`Control:   http://localhost:${PORT}/control.html`);
  console.log(`Watching:  ${registryPath}, ${phaseStatusPath}, ${blockersPath}, ${matrixPath}`);
});
