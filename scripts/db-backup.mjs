#!/usr/bin/env node
// Backup/restore procedure for local Postgres (P0-checklist: "Backup/restore
// procedure tested in non-production"). Shells out to `docker compose exec`
// rather than requiring a local psql/pg_dump install, so it works the same
// on any dev machine that already has Docker for P0-002's dev stack.

import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const run = promisify(execFile);
const COMPOSE_FILE = "docker-compose.dev.yml";
const BACKUP_DIR = "backups";

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outPath = `${BACKUP_DIR}/life-${timestamp}.dump`;

await mkdir(BACKUP_DIR, { recursive: true });

console.log(`Backing up database to ${outPath} ...`);

const { stdout } = await run(
  "docker",
  [
    "compose",
    "-f",
    COMPOSE_FILE,
    "exec",
    "-T",
    "postgres",
    "pg_dump",
    "-U",
    "life",
    "-d",
    "life",
    "--format=custom",
  ],
  { encoding: "buffer", maxBuffer: 1024 * 1024 * 1024 },
);

await writeFile(outPath, stdout);
console.log(`Wrote ${outPath} (${stdout.length} bytes).`);
console.log(`Restore with: node scripts/db-restore.mjs ${outPath}`);
