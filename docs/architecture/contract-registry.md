# Contract Registry

**Status:** Foundation
**Owner:** Chief Architect
**Depends on:** `docs/architecture/api-contracts.md`, `packages/domain-types`
**Implements:** P0-010; satisfies `docs/planning/gap-backlog.md`'s P0 item
"Contract Registry must link task DSL, rules, family lifecycle, permissions
and events."

## Why this exists

`packages/domain-types` and `services/api/openapi/openapi.yaml` each define
the same entities independently. Nothing previously cross-checked them
against each other, against `tasks/registry.yaml`'s `deps`, or against
`docs/planning/change-log.md`'s version history — so a schema could gain a
field, get renamed, or get consumed by a task that doesn't exist, and no
process would catch it until something broke downstream.

## The file

`contracts/registry.yaml` is the index: one entry ("group") per contract
family (family, task, verification, media, reward, events, classification,
plus a `PLANNED` placeholder for the not-yet-built task/rules DSL). Each
group records:

- `status` — `FROZEN` (implemented and versioned) or `PLANNED` (named so its
  absence is visible, not yet defined).
- `version` — the group's contract version. All `FROZEN` groups currently
  move together (see Versioning below).
- `owner` — the role responsible for changes (`docs/ai-team/agent-registry.yaml`).
- `defines` — the `packages/domain-types/src/*.ts` file and its exact
  exported symbol names, plus the matching OpenAPI schema names.
- `consumed_by` — `tasks/registry.yaml` task ids that build against this
  group.
- `changelog_ref` — the `docs/planning/change-log.md` heading that
  introduced or last changed this version.
- `open_decisions` — unresolved questions blocking downstream work, cross-
  referenced from `tasks/packets/P0-009-phase1-contract-pack.md` and
  `docs/planning/gap-backlog.md`.

## Validation

`task-registry contracts validate` (`pnpm run contracts:validate`,
`tools/task-registry/src/contracts.ts`) checks, for every `FROZEN` group:

1. Every claimed export actually exists in the referenced file.
2. Every export in `packages/domain-types/src/*.ts` (excluding `index.ts`,
   `ids.ts` — branded-ID primitives shared across all groups, not a group
   themselves — and `classification.ts`, which is its own group) is claimed
   by some group. An unclaimed export is a schema that shipped without
   being indexed.
3. Every `consumed_by` id exists in `tasks/registry.yaml`.
4. Every `changelog_ref` matches a real `## <ref>` heading in
   `docs/planning/change-log.md`.

Wired into CI as the "Contract registry is in sync" step in
`.github/workflows/ci.yml`'s `checks` job — it fails the same way a
TypeScript error would, not silently.

## Versioning policy

Semver-shaped, not semver-tooled (no package publishing, this is an
internal source-of-truth file):

- **patch** — doc/comment clarification, no shape change.
- **minor** — additive, backward-compatible field or enum value.
- **major** — breaking change to an already-`consumed_by` group. Requires a
  new task (never a silent edit to a frozen file) and a
  `docs/engineering/merge-gate.md` Human Architect decision, per that doc's
  "no silent scope changes" rule.

Every `FROZEN` group is at `0.2.0` today because P0-009's revalidation
touched every entity in the same pass (`docs/planning/change-log.md` 0.4 →
0.5). `packages/domain-types`'s exported `CONTRACT_VERSION` constant is that
whole-pack version. Per-group `version` fields exist so a future change can
bump one group (e.g. `reward` gets a currency-precision fix) without
implying the others moved too — at that point `CONTRACT_VERSION` and the
per-group versions would diverge, which is expected, not a bug.

## Adding a group

1. Add the entity to `packages/domain-types/src/<name>.ts` and, if it's
   API-surfaced, to `services/api/openapi/openapi.yaml`.
2. Add a `groups` entry to `contracts/registry.yaml` listing every export
   the file adds.
3. Run `pnpm run contracts:validate` — it will list any export you missed.
4. Add a `docs/planning/change-log.md` entry and point `changelog_ref` at
   it.
