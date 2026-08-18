#!/usr/bin/env node
// Persistent local dashboard server for tasks/registry.yaml.
// `pnpm run dashboard` serves the task dashboard and a separate control view:
//   /                  task board
//   /control.html      Phase/Wave/Architecture Control
//   /api/registry.json raw task registry
//   /api/control.json  task + phase status + admission-rule diagnostics
//   /events            live registry-change SSE

import { createReadStream, existsSync, readFileSync, statSync, watch } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";

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
  const matrix = readYaml(matrixPath);
  const tasks = registry.tasks ?? [];
  const taskMatrix = matrix.tasks ?? {};

  const blocked = tasks.filter(t => String(t.status).endsWith("_BLOCKED"));
  const reviewStatuses = new Set(["REVIEW", "QA", "SECURITY", "ACCEPTANCE"]);
  const review = tasks.filter(t => reviewStatuses.has(t.status));
  const done = tasks.filter(t => t.status === "DONE");

  const violations = [];
  for (const t of tasks) {
    const m = taskMatrix[t.id];
    if (t.status === "READY" || (m && m.priority === "P0" && t.phase === 1)) {
      if (!t.primary) violations.push({ id: t.id, type: "PRIMARY", message: "missing primary executor" });
      if (!t.reviewer) violations.push({ id: t.id, type: "REVIEWER", message: "missing independent reviewer" });
      if (!Array.isArray(t.gate_owners) || t.gate_owners.length === 0) violations.push({ id: t.id, type: "GATE", message: "missing gate owners" });
      if (m && !m.acceptance) violations.push({ id: t.id, type: "ACCEPTANCE", message: "participant matrix has no acceptance criteria" });
      if (m && (!Array.isArray(m.deps_contract) || !Array.isArray(m.deps_implementation))) violations.push({ id: t.id, type: "DEPENDENCY", message: "dependency classification is incomplete" });
    }
    if (t.status === "READY" && t.discovery_links?.some(d => d.blocking)) {
      violations.push({ id: t.id, type: "BLOCKING_DISCOVERY", message: "READY task has a blocking discovery" });
    }
  }

  return {
    registryVersion: registry.version,
    tasks: { total: tasks.length, done: done.length, review: review.length, blocked: blocked.length },
    phase: phaseStatus.phase,
    waves: phaseStatus.waves ?? [],
    blockers: (blockersDoc.blockers ?? []).filter(b => b.status === "OPEN"),
    violations,
  };
}

const sseClients = new Set();
function broadcastChange() {
  const payload = `event: registry-changed\ndata: ${Date.now()}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch { sseClients.delete(res); }
  }
}
let debounceTimer = null;
function onRegistryFileEvent() { clearTimeout(debounceTimer); debounceTimer = setTimeout(broadcastChange, 150); }

function serveStatic(req, res, filePath) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain" }); res.end("Not found"); return;
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
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    res.write(": connected\n\n"); sseClients.add(res); req.on("close", () => sseClients.delete(res)); return;
  }

  if (url.pathname === "/healthz") {
    res.writeHead(200, { "Content-Type": "text/plain" }); res.end("ok"); return;
  }

  const fsPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const resolved = resolve(dashboardDir, `.${fsPath}`);
  if (!resolved.startsWith(dashboardDir)) {
    res.writeHead(403, { "Content-Type": "text/plain" }); res.end("Forbidden"); return;
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
