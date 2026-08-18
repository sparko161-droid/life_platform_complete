# @life/ux-contracts

Frozen screen map, action/API catalog and UI-state mappings for the Phase 1
vertical slice (P1-009). Source specs live in `docs/ux/*.md`; this package
makes the parts of them that cross the client/server boundary
machine-checkable instead of prose-only, per `docs/planning/phases/phase-1.md`'s
"Contract gate."

## What's here

- `screens.ts` — the nine screens that have a template-conformant contract
  under `docs/ux/screens/*.md`, as a typed entry/exit graph.
- `actions.ts` — UI action → canonical operation catalog, scoped to those
  nine screens (`docs/ux/action-api-catalog.md`'s full table also covers
  screens with no contract at this tier yet).
- `task-state.ts` — `TaskAssignmentStatus`/`VerificationOutcome`
  (`@life/domain-types`) → the UI task state machine from
  `docs/ux/state-contracts.md`. Not a 1:1 rename: three real gaps between
  the two vocabularies are resolved and documented in the file, not
  papered over.
- `reward-state.ts` — same for `RewardStatus` → the UI reward states.

## Scope

Nine screens, not the full ~25-screen map. Phase 1's vertical slice needs
seven (`C-TODAY`, `C-TASK`, `C-CAMERA`, `P-DASH`, `P-TASK-BUILDER`,
`P-APPROVALS`, `P-REWARDS`); `C-GAME-LOBBY` and `SOCIAL-CHAT` are included
because they already had template-conformant contracts, not because Phase 1
needs them. `P-APPROVALS` didn't exist at this tier before this task —
Phase 1's exit criterion explicitly requires "parent can approve," so it
was written to close that gap (`docs/ux/screens/parent-approvals.md`).

## Screen identity (resolved by P1-013)

`docs/ux/screens/` used to have two tiers with two different ID schemes for
overlapping screens — this package's semantic tier (`C-TODAY`, `P-DASH`,
...) and the earlier numbered set (`UX-CHI-02`, ...). The semantic scheme
is now canonical; every retired positional id is mapped in
`RETIRED_SCREEN_IDS` (`src/screen-id-registry.ts`) so old references still
resolve, and `SPECIFIED_SCREEN_IDS` names the eight screens that have a
canonical id but no template-conformant contract yet.

The numbered documents were kept as product source. They no longer declare
an id where a contract exists; they point at the contract instead. The
rationale and the full mapping table live in `docs/ux/screen-id-scheme.md`,
and the rules are enforced by `test/screens.test.ts`, not by convention.
