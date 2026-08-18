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

## Known gap, disclosed rather than silently resolved

`docs/ux/screens/` has two tiers using different screen-ID schemes for
overlapping screens: this package's source tier (`C-TODAY`, `P-DASH`, ...,
template-conformant per `docs/ux/screen-contract-template.md`) and an
earlier, lighter numbered set (`docs/ux/screens/01-parent-registration.md`
through `17-...md`, IDs like `UX-CHI-02`) that covers more screens but in
less depth and doesn't follow the template. Recorded as a discovery on
P1-009 rather than deleting either tier unilaterally.
