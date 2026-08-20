import { SCREENS, SCREEN_IDS, type ScreenId, type Surface } from "@life/ux-contracts";

/**
 * Navigation derived from the frozen screen contracts (P1-010).
 *
 * The nav is *computed* from `SCREENS`, never hand-listed: a screen
 * marked `primaryNav: true` in the contract appears, one that is not
 * does not. A hand-written nav array is exactly how a UI drifts from
 * its contract, and ADR-0005 exists because that drift already happened
 * once with screen ids.
 *
 * Labels are the one thing the contract cannot supply -- it carries
 * routes and states, not Russian copy -- so they live here and are
 * linted by @life/ui-language's Russian-only rules like any other
 * user-facing string.
 */
export interface NavItem {
  screenId: ScreenId;
  route: string;
  label: string;
}

/** Russian labels per primary-nav screen (docs/ux/ui-language.md: no English in UI). */
const NAV_LABELS: Partial<Record<ScreenId, string>> = {
  // P-REGISTRATION and P-FAMILY-SETUP are frozen screens but not
  // primaryNav, so they need no label -- primaryNavFor only demands one
  // for screens it actually renders.
  "C-TODAY": "Мой день",
  "C-GAME-LOBBY": "Игры",
  "P-DASH": "Обзор",
  "P-TASK-BUILDER": "Новое задание",
  "P-APPROVALS": "Проверка",
  "P-REWARDS": "Награды",
};

/**
 * Primary navigation for one surface, in `SCREEN_IDS` order.
 *
 * Throws when a `primaryNav` screen has no label rather than rendering a
 * blank tab -- an unlabelled nav entry is a bug that should fail loudly
 * at startup, not ship as an empty button.
 */
export function primaryNavFor(surface: Surface): NavItem[] {
  return SCREEN_IDS.filter((id) => SCREENS[id].surface === surface && SCREENS[id].primaryNav).map((id) => {
    const label: string | undefined = NAV_LABELS[id];
    if (!label) {
      throw new Error(`Screen ${id} is primaryNav but has no Russian label in NAV_LABELS`);
    }
    return { screenId: id, route: SCREENS[id].route, label };
  });
}

/** Every route the contract defines for a surface, nav or not. */
export function routesFor(surface: Surface): string[] {
  return SCREEN_IDS.filter((id) => SCREENS[id].surface === surface).map((id) => SCREENS[id].route);
}
