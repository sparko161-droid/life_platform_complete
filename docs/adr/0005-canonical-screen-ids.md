# ADR-0005 Canonical Screen Identifiers

**Status:** Accepted
**Owner:** UI/UX Lead
**Depends on:** docs/ux/screen-contract-template.md
**Related:** docs/ux/screen-id-scheme.md, packages/ux-contracts, BLK-P1-001 / DISC-P1-009-1, P1-013

## Context
Two screen-ID schemes coexisted. The semantic, surface-prefixed one
(`C-TODAY`, `P-APPROVALS`) is used by `packages/ux-contracts`, the OpenAPI
operation mapping and the frontend. The positional one (`UX-CHI-02`,
`UX-PAR-04`) is used by the earlier product sketches in
`docs/ux/screens/01-17-*.md`, which cover more screens in less depth. The
same screen therefore had two names and nothing connected them, so a
reference from a test, an analytics event or a ticket had no single
resolution. Recorded as DISC-P1-009-1 and blocked five Phase 1 tasks as
BLK-P1-001.

## Decision
The semantic scheme is canonical. The positional scheme is retired and
mapped, not deleted: `RETIRED_SCREEN_IDS` in
`packages/ux-contracts/src/screen-id-registry.ts` resolves every old id.
The namespace has two tiers — `SCREEN_IDS` (contract frozen against
`screen-contract-template.md`) and `SPECIFIED_SCREEN_IDS` (canonically
named, contract not written yet).

Screen *boundaries* are not re-decided here. Where the tiers disagreed
about whether chat and rewards are one screen or two, the
template-conformant document is taken as the answer, because it states it
explicitly.

## Alternatives
- **Keep the positional scheme.** Rejected: it exists only in prose, it
  renumbers unrelated screens when one is inserted, and it had already
  broken — `11-parent-rewards.md` carried `UX-PAR-05 / UX-CHI-06` for one
  screen, because a surface-partitioned namespace cannot express a screen
  serving both surfaces.
- **Keep both, with a mapping table only.** Rejected: two live identities
  for one screen is the defect, not the documentation of it. A mapping
  would have to be consulted forever, and drift would be undetectable.
- **Delete the numbered sketches.** Rejected: they hold product
  requirements in Russian that the contracts do not carry. They were kept
  and demoted — they no longer declare an id where a contract exists.

## Consequences
- Every screen document declares exactly one canonical id, and every
  canonical id is declared by exactly one document. Both are enforced by
  `packages/ux-contracts/test/screens.test.ts`, so drift fails CI instead
  of accumulating.
- Old references keep working through `resolveScreenId()`.
- A screen cannot enter `SCREEN_IDS` without a template-conformant
  contract, so "frozen" keeps meaning something.
- `RETIRED_SCREEN_IDS` is append-only: repointing an entry would silently
  change the meaning of an existing reference.
- The eight specified-but-unfrozen screens now have canonical names before
  their contracts exist, which is deliberate — it removes the window in
  which a second identity could appear.

## Reversal plan
The canonical ids are referenced from `screens.ts`, `actions.ts`, the
screen documents and the OpenAPI mapping. Reversal means choosing a new
scheme, adding the current ids to `RETIRED_SCREEN_IDS` (never removing the
existing entries) and rewriting the declaring line in each screen document.
The tests that enforce uniqueness make an incomplete reversal fail loudly
rather than leave a half-migrated namespace, which is the state this ADR
exists to end.

## Revisit when
A surface prefix stops describing reality — for example a screen genuinely
shared across surfaces with no primary owner, as nearly happened with
rewards.
