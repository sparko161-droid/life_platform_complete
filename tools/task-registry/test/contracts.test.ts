import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { validateContractRegistry, type ContractRegistry } from "../src/contracts.js";
import type { Registry } from "../src/schema.js";

function fixtureRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "contracts-test-"));
  const srcDir = join(dir, "packages/domain-types/src");
  mkdirSync(srcDir, { recursive: true });
  writeFileSync(
    join(srcDir, "widget.ts"),
    [
      "export const WIDGET_KINDS = [\"A\", \"B\"] as const;",
      "export type WidgetKind = (typeof WIDGET_KINDS)[number];",
      "export const WidgetSchema = { kind: \"placeholder\" };",
      "export type Widget = typeof WidgetSchema;",
    ].join("\n"),
  );
  mkdirSync(join(dir, "docs/planning"), { recursive: true });
  writeFileSync(join(dir, "docs/planning/change-log.md"), "# Change log\n\n## 0.4\n\n- did stuff\n");
  return dir;
}

function fixtureTaskRegistry(): Registry {
  return {
    version: 1,
    tasks: [
      {
        id: "P1-001",
        phase: 1,
        title: "Consumer task",
        primary: "backend-lead",
        status: "READY",
        deps: [],
        reviewer: null,
        gate_owners: [],
        discovery_links: [],
        blocked_reason: null,
        human_decisions: [],
        origin_discovery: null,
        discovered_from: null,
      },
    ],
  };
}

function fixtureContracts(overrides: Partial<ContractRegistry["groups"][number]> = {}): ContractRegistry {
  return {
    version: 1,
    contract_pack_version: "0.1.0",
    groups: [
      {
        name: "widget",
        status: "FROZEN",
        version: "0.1.0",
        owner: "backend-lead",
        defines: {
          domain_types: "packages/domain-types/src/widget.ts",
          exports: ["WIDGET_KINDS", "WidgetKind", "WidgetSchema", "Widget"],
          openapi_schemas: [],
        },
        consumed_by: ["P1-001"],
        changelog_ref: "0.4",
        open_decisions: [],
        ...overrides,
      },
    ],
  };
}

test("a fully-matched registry has no problems", () => {
  const root = fixtureRoot();
  try {
    const problems = validateContractRegistry(fixtureContracts(), {
      repoRoot: root,
      taskRegistry: fixtureTaskRegistry(),
      changelogPath: join(root, "docs/planning/change-log.md"),
      domainTypesSrcDir: "packages/domain-types/src",
      orphanScanExclude: [],
    });
    assert.deepEqual(problems, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("flags an export claimed in the registry but absent from the file", () => {
  const root = fixtureRoot();
  try {
    const contracts = fixtureContracts({
      defines: {
        domain_types: "packages/domain-types/src/widget.ts",
        exports: ["WIDGET_KINDS", "DoesNotExist"],
        openapi_schemas: [],
      },
    });
    const problems = validateContractRegistry(contracts, {
      repoRoot: root,
      taskRegistry: fixtureTaskRegistry(),
      changelogPath: join(root, "docs/planning/change-log.md"),
      domainTypesSrcDir: "packages/domain-types/src",
      orphanScanExclude: [],
    });
    assert.ok(problems.some((p) => p.includes('"DoesNotExist" not found')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("flags a real export the registry never claimed (orphan)", () => {
  const root = fixtureRoot();
  try {
    const contracts = fixtureContracts({
      defines: {
        domain_types: "packages/domain-types/src/widget.ts",
        exports: ["WIDGET_KINDS"], // Widget/WidgetKind/WidgetSchema left unclaimed
        openapi_schemas: [],
      },
    });
    const problems = validateContractRegistry(contracts, {
      repoRoot: root,
      taskRegistry: fixtureTaskRegistry(),
      changelogPath: join(root, "docs/planning/change-log.md"),
      domainTypesSrcDir: "packages/domain-types/src",
      orphanScanExclude: [],
    });
    assert.ok(problems.some((p) => p.includes('"Widget" is not claimed')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("flags a consumed_by task id that doesn't exist in tasks/registry.yaml", () => {
  const root = fixtureRoot();
  try {
    const contracts = fixtureContracts({ consumed_by: ["P9-999"] });
    const problems = validateContractRegistry(contracts, {
      repoRoot: root,
      taskRegistry: fixtureTaskRegistry(),
      changelogPath: join(root, "docs/planning/change-log.md"),
      domainTypesSrcDir: "packages/domain-types/src",
      orphanScanExclude: [],
    });
    assert.ok(problems.some((p) => p.includes("unknown task P9-999")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("flags a changelog_ref with no matching heading", () => {
  const root = fixtureRoot();
  try {
    const contracts = fixtureContracts({ changelog_ref: "9.9" });
    const problems = validateContractRegistry(contracts, {
      repoRoot: root,
      taskRegistry: fixtureTaskRegistry(),
      changelogPath: join(root, "docs/planning/change-log.md"),
      domainTypesSrcDir: "packages/domain-types/src",
      orphanScanExclude: [],
    });
    assert.ok(problems.some((p) => p.includes('changelog_ref "9.9"')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a PLANNED group with no domain_types file is not an error", () => {
  const root = fixtureRoot();
  try {
    const contracts: ContractRegistry = {
      version: 1,
      contract_pack_version: "0.1.0",
      groups: [
        {
          name: "task_dsl",
          status: "PLANNED",
          version: null,
          owner: "backend-lead",
          defines: { domain_types: null, exports: [], openapi_schemas: [] },
          consumed_by: [],
          changelog_ref: null,
          open_decisions: ["not built yet"],
        },
      ],
    };
    const problems = validateContractRegistry(contracts, {
      repoRoot: root,
      taskRegistry: fixtureTaskRegistry(),
      changelogPath: join(root, "docs/planning/change-log.md"),
      domainTypesSrcDir: "packages/domain-types/src",
      orphanScanExclude: [],
    });
    // widget.ts's exports are still orphaned since nothing claims them, but
    // that's the point of the check -- assert specifically that PLANNED
    // itself didn't produce a "must have a version"/"must set domain_types" complaint.
    assert.ok(!problems.some((p) => p.includes("task_dsl:")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
