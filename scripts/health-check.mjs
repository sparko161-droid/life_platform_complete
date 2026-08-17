#!/usr/bin/env node
// Verifies the local dev stack (docker-compose.dev.yml) is actually healthy,
// per docs/engineering/local-environment.md:
//   Postgres: pg_isready
//   Redis:    PING
//   MinIO:    web console reachable on port 9001
//
// Zero-dependency by design (plain Node + `docker compose exec`/fetch) so it
// runs the same way in CI and on a developer machine without an install step.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const COMPOSE_FILE = "docker-compose.dev.yml";

/** @type {{ name: string, check: () => Promise<string> }[]} */
const checks = [
  {
    name: "postgres",
    async check() {
      const { stdout } = await run("docker", [
        "compose",
        "-f",
        COMPOSE_FILE,
        "exec",
        "-T",
        "postgres",
        "pg_isready",
        "-U",
        "life",
        "-d",
        "life",
      ]);
      return stdout.trim();
    },
  },
  {
    name: "redis",
    async check() {
      const { stdout } = await run("docker", [
        "compose",
        "-f",
        COMPOSE_FILE,
        "exec",
        "-T",
        "redis",
        "redis-cli",
        "ping",
      ]);
      const reply = stdout.trim();
      if (reply !== "PONG") throw new Error(`unexpected reply: ${reply}`);
      return reply;
    },
  },
  {
    name: "minio",
    async check() {
      const res = await fetch("http://localhost:9000/minio/health/live");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return `HTTP ${res.status}`;
    },
  },
];

let failed = false;
for (const { name, check } of checks) {
  try {
    const detail = await check();
    console.log(`OK   ${name}: ${detail}`);
  } catch (err) {
    failed = true;
    console.error(`FAIL ${name}: ${err instanceof Error ? err.message : err}`);
  }
}

if (failed) {
  console.error(
    "\nOne or more services are not healthy. Try: pnpm dev:infra ; pnpm dev:infra:logs",
  );
  process.exit(1);
}
console.log("\nAll local infra services healthy.");
