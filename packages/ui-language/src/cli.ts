#!/usr/bin/env node
/**
 * CI entry point for P1-012 (Russian-only UI localization lint and
 * forbidden-term checks). Wired as this package's `lint` script, which
 * `pnpm -r --if-present run lint` (the root `lint` script CI runs) picks up
 * automatically -- this is what makes the acceptance criterion "Required
 * Russian-only UI scope is mechanically checked in CI" true rather than
 * aspirational.
 *
 * Exits 1 with every violation printed when the catalog is not clean, 0
 * otherwise.
 */
import { UI_STRINGS } from "./catalog.js";
import { lintCatalog } from "./lint.js";

function main(): void {
  const violations = lintCatalog(UI_STRINGS);

  if (violations.length === 0) {
    console.log(`ui-language lint: OK (${Object.keys(UI_STRINGS).length} strings checked, 0 violations)`);
    return;
  }

  console.error(`ui-language lint: FAILED (${violations.length} violation(s))\n`);
  for (const v of violations) {
    const suggestion = v.suggestion ? ` -- suggested: ${v.suggestion}` : "";
    console.error(`  [${v.code}] ${v.key}: ${v.message}${suggestion}`);
  }
  process.exitCode = 1;
}

main();
