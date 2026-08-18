import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { load } from "js-yaml";
import { z } from "zod";
import type { Registry } from "./schema.js";

const contractGroupSchema = z.object({
  name: z.string(),
  status: z.enum(["FROZEN", "PLANNED"]),
  version: z.string().nullable(),
  owner: z.string(),
  defines: z.object({
    domain_types: z.string().nullable(),
    exports: z.array(z.string()),
    openapi_schemas: z.array(z.string()),
  }),
  consumed_by: z.array(z.string()),
  changelog_ref: z.string().nullable(),
  open_decisions: z.array(z.string()),
});

const contractRegistrySchema = z.object({
  version: z.number().int().positive(),
  contract_pack_version: z.string(),
  groups: z.array(contractGroupSchema),
});

export type ContractRegistry = z.infer<typeof contractRegistrySchema>;
export type ContractGroup = z.infer<typeof contractGroupSchema>;

export function loadContractRegistry(filePath: string): ContractRegistry {
  const raw = load(readFileSync(filePath, "utf8"));
  return contractRegistrySchema.parse(raw);
}

// A loose but real export scan: matches `export const NAME`, `export
// function NAME`, `export type NAME`. Good enough to catch "the registry
// claims this symbol exists but it doesn't" and "this symbol exists but
// nothing registered it" without pulling in the TS compiler API for a
// drift check that doesn't need full type information.
function exportedSymbols(fileContents: string): Set<string> {
  const names = new Set<string>();
  const re = /^export\s+(?:const|function|type)\s+([A-Za-z_$][\w$]*)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fileContents))) {
    const name = m[1];
    if (name) names.add(name);
  }
  return names;
}

export interface ContractValidationOptions {
  repoRoot: string;
  taskRegistry: Registry;
  changelogPath: string;
  domainTypesSrcDir: string;
  /** src files under domainTypesSrcDir excluded from the orphan-export scan (infra, not a contract group). */
  orphanScanExclude: string[];
}

export function validateContractRegistry(
  contracts: ContractRegistry,
  opts: ContractValidationOptions,
): string[] {
  const problems: string[] = [];
  const taskIds = new Set(opts.taskRegistry.tasks.map((t) => t.id));
  const changelog = existsSync(opts.changelogPath) ? readFileSync(opts.changelogPath, "utf8") : "";

  const registeredExports = new Set<string>();

  for (const group of contracts.groups) {
    if (group.status === "FROZEN") {
      if (!group.version) problems.push(`${group.name}: FROZEN group must have a version`);
      if (!group.defines.domain_types) {
        problems.push(`${group.name}: FROZEN group must set defines.domain_types`);
      } else {
        const filePath = resolve(opts.repoRoot, group.defines.domain_types);
        if (!existsSync(filePath)) {
          problems.push(`${group.name}: defines.domain_types file not found: ${group.defines.domain_types}`);
        } else {
          const contents = readFileSync(filePath, "utf8");
          const actual = exportedSymbols(contents);
          for (const name of group.defines.exports) {
            if (!actual.has(name)) {
              problems.push(
                `${group.name}: export "${name}" not found in ${group.defines.domain_types}`,
              );
            }
            registeredExports.add(name);
          }
        }
      }
      if (group.changelog_ref && !changelog.includes(`## ${group.changelog_ref}`)) {
        problems.push(
          `${group.name}: changelog_ref "${group.changelog_ref}" has no matching "## ${group.changelog_ref}" heading in ${opts.changelogPath}`,
        );
      }
    }

    for (const id of group.consumed_by) {
      if (!taskIds.has(id)) {
        problems.push(`${group.name}: consumed_by references unknown task ${id}`);
      }
    }
  }

  // Orphan check: every exported schema/const/type in domain-types (outside
  // the excluded infra files) should be claimed by some group, so a new
  // entity can't silently ship without being indexed here.
  const srcDir = resolve(opts.repoRoot, opts.domainTypesSrcDir);
  if (existsSync(srcDir)) {
    for (const file of readdirSync(srcDir)) {
      if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
      if (opts.orphanScanExclude.includes(file)) continue;
      const contents = readFileSync(resolve(srcDir, file), "utf8");
      for (const name of exportedSymbols(contents)) {
        if (!registeredExports.has(name)) {
          problems.push(
            `${opts.domainTypesSrcDir}/${file}: export "${name}" is not claimed by any group in contracts/registry.yaml`,
          );
        }
      }
    }
  }

  return problems;
}
