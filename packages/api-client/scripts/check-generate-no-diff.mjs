#!/usr/bin/env node
// CI guard for docs/engineering/repo-structure.md's "Generated files are
// reproducible and not hand-edited": regenerate the OpenAPI client and fail
// if that produces an uncommitted diff, which would mean either the spec
// changed without regenerating, or someone hand-edited the generated file.
//
// Not yet wired into .github/workflows/ci.yml as of P0-005 -- that file is
// owned by P0-001 on a separate not-yet-merged branch. Add a step running
// `pnpm --filter @life/api-client run generate:check` once P0-001 merges.

import { execFileSync } from "node:child_process";

// Node warns when passing an argv array together with shell:true (args
// aren't escaped, only concatenated). All arguments here are static
// string literals we wrote ourselves, not external input, so pass a
// single pre-joined command string instead -- the documented safe form.
execFileSync("pnpm run generate", { stdio: "inherit", shell: true });

const diff = execFileSync("git", ["status", "--porcelain", "--", "src/generated"], {
  encoding: "utf8",
});

if (diff.trim().length > 0) {
  console.error(
    "src/generated is out of date with services/api/openapi/openapi.yaml.\n" +
      "Run `pnpm --filter @life/api-client run generate` and commit the result.\n\n" +
      diff,
  );
  process.exit(1);
}

console.log("Generated client is up to date with openapi.yaml.");
