/**
 * Canonical screen identity (P1-013, resolves BLK-P1-001 / DISC-P1-009-1).
 *
 * Two schemes coexisted: the semantic ids in `screens.ts` (`C-TODAY`,
 * `P-DASH`, ...), used by the template-conformant contracts and by code,
 * and the positional ids in the earlier sketches under
 * `docs/ux/screens/01-17-*.md` (`UX-CHI-02`, `UX-PAR-04`, ...). The same
 * screen therefore had two names, and nothing could tell you they were the
 * same screen.
 *
 * The semantic scheme is canonical. Reasons, in order of weight:
 *   1. It is the one code already consumes -- `screens.ts`, `actions.ts`,
 *      the OpenAPI operation mapping and the frontend all key off it. The
 *      positional scheme exists only in prose.
 *   2. It is surface-prefixed and stable. A positional id encodes a
 *      document's position in a folder listing, so inserting a screen
 *      renumbers unrelated screens.
 *   3. The positional scheme had already broken down in practice:
 *      `11-parent-rewards.md` carries *two* ids (`UX-PAR-05 / UX-CHI-06`)
 *      because one screen serves both surfaces, which a positional,
 *      surface-partitioned namespace cannot express.
 *
 * Nothing here re-decides product questions. Where the two tiers disagreed
 * about screen *boundaries* -- one chat screen or two, one rewards screen
 * or two -- the template-conformant document is taken as the answer,
 * because it states it explicitly (`docs/ux/screens/social-chat.md`:
 * "Parent chat, child chat and permitted family/group chat use the same
 * conversation model with different policies").
 */

import { SCREEN_IDS, type ScreenId } from "./screens.js";

/**
 * Screens that are named canonically and specified in prose, but do not
 * (yet) have a template-conformant contract in `SCREENS`. They are outside
 * the Phase 1 vertical slice. Listed here so the canonical namespace is
 * complete -- a screen must not be able to acquire a second identity just
 * because Phase 1 did not need it yet.
 */
export const SPECIFIED_SCREEN_IDS = [
  "P-REGISTRATION",
  "P-FAMILY-SETUP",
  "P-CHILD-PROFILE",
  "P-SOCIAL",
  "P-CHAT",
  "P-SETTINGS",
  "C-VERIFICATION",
  "C-FRIENDS",
] as const;
export type SpecifiedScreenId = (typeof SPECIFIED_SCREEN_IDS)[number];

/** Every canonical screen id, contract-frozen or merely specified. */
export const CANONICAL_SCREEN_IDS = [...SCREEN_IDS, ...SPECIFIED_SCREEN_IDS] as const;
export type CanonicalScreenId = ScreenId | SpecifiedScreenId;

/**
 * Retired positional id -> canonical id, so an existing reference in a
 * ticket, an analytics dashboard or someone's notes can still be resolved
 * instead of becoming a dead end. This map is append-only history: entries
 * are never repointed, because that would silently change what an old
 * reference means.
 *
 * `UX-PAR-05` and `UX-CHI-06` both map to `P-REWARDS`: the same screen was
 * filed under both surfaces.
 */
export const RETIRED_SCREEN_IDS: Readonly<Record<string, CanonicalScreenId>> = {
  "UX-PAR-01": "P-REGISTRATION",
  "UX-FAM-01": "P-FAMILY-SETUP",
  "UX-CHI-01": "P-CHILD-PROFILE",
  "UX-CHI-02": "C-TODAY",
  "UX-CHI-03": "C-TASK",
  "UX-CHI-04": "C-VERIFICATION",
  "UX-CHI-05": "C-CAMERA",
  "UX-PAR-02": "P-DASH",
  "UX-PAR-03": "P-TASK-BUILDER",
  "UX-PAR-04": "P-APPROVALS",
  "UX-PAR-05": "P-REWARDS",
  "UX-CHI-06": "P-REWARDS",
  "UX-SOC-01": "P-SOCIAL",
  "UX-SOC-02": "C-FRIENDS",
  "UX-SOC-03": "SOCIAL-CHAT",
  "UX-SOC-04": "P-CHAT",
  "UX-GAM-01": "C-GAME-LOBBY",
  "UX-PAR-06": "P-SETTINGS",
};

/** Resolve any id -- canonical or retired -- to its canonical form. */
export function resolveScreenId(id: string): CanonicalScreenId | undefined {
  if ((CANONICAL_SCREEN_IDS as readonly string[]).includes(id)) {
    return id as CanonicalScreenId;
  }
  return RETIRED_SCREEN_IDS[id];
}
