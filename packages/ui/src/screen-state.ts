import { SCREENS, type ScreenId, type ScreenStates } from "@life/ux-contracts";

/**
 * Exhaustive screen-state handling (P1-016).
 *
 * `docs/ux/error-recovery.md` and every screen contract in
 * `packages/ux-contracts` list the states a screen must handle --
 * including the ones nobody enjoys building, like `OFFLINE` and
 * `FAILED_SYNC`. Those are exactly the states that get skipped, and
 * skipping them is how a UI ends up with a blank screen instead of a
 * recovery path.
 *
 * `defineScreenStates` makes that a compile error rather than a review
 * comment: the map it takes is keyed on the screen's own literal state
 * union, so a screen that misses one does not build, and a contract that
 * gains a state breaks every screen that has not caught up.
 *
 * The handoffs for P1-032 and P1-036 both recorded "declares states the
 * pages do not render" as an open risk. This is the mechanism that lets
 * that stop being a recurring note.
 */

/** A per-state entry. `T` is whatever the surface renders (a node, a component, a key). */
export type ScreenStateMap<Id extends ScreenId, T> = { readonly [S in ScreenStates<Id>]: T };

export interface ScreenStateHandler<Id extends ScreenId, M> {
  readonly screenId: Id;
  readonly states: M;
  /** Resolves a state to its entry. Total by construction. */
  render(state: ScreenStates<Id>): M[keyof M];
  /**
   * Resolves a state that arrived as a plain string -- e.g. from an API
   * response or a URL. Returns `undefined` rather than throwing, so a
   * caller decides whether an unrecognised state is a bug or just stale
   * data from an older client.
   */
  tryRender(state: string): M[keyof M] | undefined;
}

/**
 * Binds a screen id to a complete map of its declared states.
 *
 * Passing an incomplete map is a type error; passing a state the contract
 * does not declare is also a type error. Both directions matter -- the
 * second is what catches a state that was renamed in the contract and
 * left behind in the UI.
 *
 * `M` is inferred from the object literal rather than from a mapped type,
 * so the entry type survives: constraining `states` to
 * `ScreenStateMap<Id, T>` directly makes TypeScript infer `T` as
 * `unknown`, which pushes an `as` cast onto every call site and quietly
 * gives up the type safety this module exists for.
 */
export function defineScreenStates<Id extends ScreenId, M extends ScreenStateMap<Id, M[keyof M]>>(
  screenId: Id,
  states: M,
): ScreenStateHandler<Id, M> {
  return {
    screenId,
    states,
    render: (state) => (states as Record<string, M[keyof M]>)[state]!,
    tryRender: (state) => (states as Record<string, M[keyof M]>)[state],
  };
}

/**
 * Runtime check that a handler covers exactly the contract's states.
 *
 * The type system already guarantees this for code compiled against the
 * current contract. This exists for the case the types cannot see: a
 * prebuilt `dist` compiled against an older `@life/ux-contracts`, which
 * is precisely the stale-build problem that has bitten this repo before
 * (`ci.yml` documents building before typechecking for the same reason).
 *
 * Returns the discrepancies rather than throwing, so a test can report
 * all of them at once.
 */
export function screenStateGaps(handler: { screenId: ScreenId; states: object }): {
  missing: string[];
  extra: string[];
} {
  const declared = new Set<string>(SCREENS[handler.screenId].states);
  const handled = new Set(Object.keys(handler.states));
  return {
    missing: [...declared].filter((s) => !handled.has(s)),
    extra: [...handled].filter((s) => !declared.has(s)),
  };
}
