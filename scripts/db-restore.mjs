#!/usr/bin/env node
// Restores a dump produced by scripts/db-backup.mjs. Non-production only --
// this drops and recreates objects in whatever database DATABASE_URL/the
// dev stack points at. Never point this at a production connection string.

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

const COMPOSE_FILE = "docker-compose.dev.yml";

const dumpPath = process.argv[2];
if (!dumpPath) {
  console.error("Usage: node scripts/db-restore.mjs <path-to-dump-file>");
  process.exit(1);
}

const dump = await readFile(dumpPath);
console.log(`Restoring ${dumpPath} (${dump.length} bytes) ...`);

// child_process.execFile's callback/promisified form has no `input` option
// -- that only exists on the *Sync variants (execFileSync/spawnSync). An
// earlier version of this script passed `{ input: dump }` to a promisified
// execFile call; it silently did nothing, pg_restore sat waiting on a
// stdin that was never written to or closed, and the process hung forever
// (caught by actually testing this against the live stack, not just
// reading the docs). `spawn` gives a real writable `child.stdin` instead.
await new Promise((resolve, reject) => {
  const child = spawn(
    "docker",
    [
      "compose",
      "-f",
      COMPOSE_FILE,
      "exec",
      "-T",
      "postgres",
      "pg_restore",
      "-U",
      "life",
      "-d",
      "life",
      "--clean",
      "--if-exists",
    ],
    { stdio: ["pipe", "inherit", "inherit"] },
  );

  child.on("error", reject);
  child.on("close", (code) => {
    if (code === 0) resolve();
    else reject(new Error(`pg_restore exited with code ${code}`));
  });

  child.stdin.write(dump);
  child.stdin.end();
});

console.log("Restore complete.");
