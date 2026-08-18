#!/usr/bin/env node
// Automated docs/task traceability check (P0-012).
//
// docs/DOCS_GRAPH.md is the hand-maintained index MASTER_SPEC.md points to
// ("Detail stays in short authoritative files"). Nothing previously checked
// it against the real docs/ tree, so it can drift silently in two
// directions: a listed path that no longer exists (dead reference), or a
// real doc that was never added to the index (invisible to anyone
// navigating from MASTER_SPEC.md). Both happened for real before this
// script existed -- docs/engineering/, docs/implementations/,
// docs/planning/, docs/governance/, docs/learning/, docs/platform/ all
// arrived during Phase 0 execution and were never added to DOCS_GRAPH.md.
//
// This also checks task-id cross-references: every `P<phase>-<NNN>` token
// mentioned in docs/ or tasks/ should name a task that actually exists in
// tasks/registry.yaml, catching typos and stale references to
// renamed/removed tasks.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = resolve(repoRoot, "docs");

// Directory-index files that document their own directory rather than a
// separate content page -- not something DOCS_GRAPH.md is expected to list.
const SELF_INDEX_EXEMPT = new Set([
  "DOCS_GRAPH.md",
  "MASTER_SPEC.md",
  "REFERENCES.md",
  "adr/README.md",
  "ai-team/instructions/README.md",
  "cases/README.md",
  "implementations/README.md",
]);

function readDocsGraphEntries() {
  const text = readFileSync(resolve(docsDir, "DOCS_GRAPH.md"), "utf8");
  const literal = new Set();
  const wildcardDirs = []; // e.g. "ux/screens/" from `ux/screens/*.md`
  const directoryRefs = []; // e.g. "cases/" from a prose "`cases/` contains ..." mention

  for (const m of text.matchAll(/`([A-Za-z0-9_./*-]+)`/g)) {
    const token = m[1];
    if (token.endsWith("/*.md")) {
      wildcardDirs.push(token.slice(0, -"*.md".length));
    } else if (token.endsWith(".md")) {
      literal.add(token);
    } else if (token.endsWith("/")) {
      directoryRefs.push(token);
    }
  }
  return { literal, wildcardDirs, directoryRefs };
}

function walkMarkdownFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(docsDir, full).split("\\").join("/");
    if (statSync(full).isDirectory()) {
      out.push(...walkMarkdownFiles(full));
    } else if (entry.endsWith(".md")) {
      out.push(rel);
    }
  }
  return out;
}

function checkDocsGraph() {
  const problems = [];
  const { literal, wildcardDirs, directoryRefs } = readDocsGraphEntries();
  const realFiles = walkMarkdownFiles(docsDir);
  const realFileSet = new Set(realFiles);

  for (const path of literal) {
    if (!realFileSet.has(path)) {
      problems.push(`DOCS_GRAPH.md references "${path}", which does not exist under docs/.`);
    }
  }

  const isCovered = (path) => {
    if (literal.has(path)) return true;
    if (SELF_INDEX_EXEMPT.has(path)) return true;
    if (path.split("/").pop() === "README.md") return true;
    if (wildcardDirs.some((dir) => path.startsWith(dir))) return true;
    if (directoryRefs.some((dir) => path.startsWith(dir))) return true;
    return false;
  };

  for (const path of realFiles) {
    if (!isCovered(path)) {
      problems.push(`docs/${path} exists but is not referenced by DOCS_GRAPH.md (orphan doc).`);
    }
  }

  return problems;
}

function readKnownTaskIds() {
  // Deliberately not a full YAML parse (avoids a js-yaml dependency for a
  // script this small): every task record's id follows the fixed
  // `  - id: P0-001` shape saveRegistry() always writes.
  const text = readFileSync(resolve(repoRoot, "tasks/registry.yaml"), "utf8");
  const ids = new Set();
  for (const m of text.matchAll(/^\s*-\s*id:\s*(\S+)/gm)) ids.add(m[1]);
  return ids;
}

function checkTaskReferences() {
  const problems = [];
  const knownIds = readKnownTaskIds();

  const searchRoots = [docsDir, resolve(repoRoot, "tasks"), resolve(repoRoot, "AGENTS.md")];
  const filesToScan = [];
  for (const root of searchRoots) {
    if (!statSync(root).isDirectory()) {
      filesToScan.push(root);
      continue;
    }
    const walk = (dir) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (entry.endsWith(".md") || entry.endsWith(".yaml")) filesToScan.push(full);
      }
    };
    walk(root);
  }

  const taskIdPattern = /\bP\d+-\d{3}\b/g;
  for (const file of filesToScan) {
    const rel = relative(repoRoot, file).split("\\").join("/");
    if (/template/i.test(rel)) continue; // template files intentionally hold placeholder ids like P0-000
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(taskIdPattern)) {
      const id = m[0];
      if (!knownIds.has(id)) {
        problems.push(`${rel}: references task "${id}", which does not exist in tasks/registry.yaml.`);
      }
    }
  }

  return problems;
}

const docsGraphProblems = checkDocsGraph();
const taskRefProblems = checkTaskReferences();
const allProblems = [...docsGraphProblems, ...taskRefProblems];

if (allProblems.length > 0) {
  console.error(`Docs/task traceability check FAILED (${allProblems.length} problem(s)):`);
  for (const p of allProblems) console.error(`  - ${p}`);
  process.exitCode = 1;
} else {
  console.log("Docs/task traceability OK: DOCS_GRAPH.md matches the real docs/ tree, and every P<phase>-<NNN> reference resolves to a real task.");
}
