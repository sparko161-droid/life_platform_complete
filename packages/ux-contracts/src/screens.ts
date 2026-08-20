/**
 * Screen map, typed (P1-009). Source: docs/ux/screens/*.md -- specifically
 * the template-conformant tier (docs/ux/screen-contract-template.md), not
 * the earlier numbered 01-17 sketches. Those two tiers use different ID
 * schemes for overlapping screens (e.g. `C-TODAY` here vs `UX-CHI-02` in
 * `docs/ux/screens/04-child-today.md`) -- a real inconsistency, not a typo,
 * recorded as a discovery on this task rather than silently resolved by
 * deleting either a human wrote.
 *
 * Scope: the nine screens that already have a template-conformant contract.
 * Phase 1's vertical slice (`docs/planning/phases/phase-1.md`: "child today
 * → task → proof → result → today"; "parent can create/edit a task ...
 * child can complete it ... parent can approve") needs seven of these
 * (C-TODAY, C-TASK, C-CAMERA, P-DASH, P-TASK-BUILDER, P-APPROVALS,
 * P-REWARDS); C-GAME-LOBBY and SOCIAL-CHAT are included because they
 * already have contracts too, not because Phase 1 requires them.
 *
 * P-APPROVALS did not exist at this tier before this task -- only the
 * lighter `docs/ux/screens/10-parent-approvals.md` did, and Phase 1's exit
 * criterion explicitly requires "parent can approve." Written to match
 * the template as `docs/ux/screens/parent-approvals.md` alongside this file.
 */

export const SCREEN_IDS = [
  // Entry screens, frozen by P1-032 once the sign-in flow existed to
  // write a contract against. ADR-0005 requires a template-conformant
  // document before a screen enters this list, which is why they were
  // only "specified" until now.
  "P-REGISTRATION",
  "P-FAMILY-SETUP",
  "C-TODAY",
  "C-TASK",
  "C-CAMERA",
  "C-GAME-LOBBY",
  "P-DASH",
  "P-TASK-BUILDER",
  "P-APPROVALS",
  "P-REWARDS",
  "SOCIAL-CHAT",
] as const;
export type ScreenId = (typeof SCREEN_IDS)[number];

export type Surface = "child" | "parent";

export interface ScreenContract {
  id: ScreenId;
  surface: Surface;
  route: string;
  owner: string;
  /** docs/ux/screens/<file>.md, relative to the repo root */
  docRef: string;
  /** Screens whose primary action leads directly to this one. */
  entryFrom: ScreenId[];
  /** Screens this screen's primary actions lead directly to. */
  exitTo: ScreenId[];
  /**
   * Reachable at any time from the surface's persistent navigation, not
   * only by completing another screen's action -- per docs/ux/screen-map.md
   * (e.g. child bottom nav: today/quests/progress/friends/games).
   */
  primaryNav: boolean;
  /** States as named in the screen's own doc (docs/ux/ui-architecture.md's "Universal states" are implied on every entry and not repeated here). */
  states: readonly string[];
}

// `satisfies` rather than a type annotation, deliberately: an annotation
// widens every `states` array to `readonly string[]`, which throws away
// exactly the information a consumer needs. With `satisfies` the shape is
// still checked, but each screen keeps its literal state union -- so
// `ScreenStates<"C-TODAY">` is the real list, and a UI can be made to
// prove it handles all of them at compile time rather than by hand.
export const SCREENS = {
  "P-REGISTRATION": {
    id: "P-REGISTRATION",
    surface: "parent",
    route: "/parent/sign-in",
    owner: "UI/UX Lead + Backend Lead",
    docRef: "docs/ux/screens/parent-registration.md",
    // Nothing leads here: it is the entry point, reached by an
    // unauthenticated visitor rather than from another screen.
    entryFrom: [],
    exitTo: ["P-FAMILY-SETUP", "P-DASH"],
    // Not in the nav: a signed-in parent has no reason to navigate back
    // to sign-in, and showing it would imply they are not signed in.
    primaryNav: false,
    states: [
      "LOADING",
      "READY",
      "SUBMITTING",
      "VALIDATION_ERROR",
      "SIGN_IN_FAILED",
      "TOO_MANY_ATTEMPTS",
      "NETWORK_ERROR",
      "OFFLINE",
    ],
  },
  "P-FAMILY-SETUP": {
    id: "P-FAMILY-SETUP",
    surface: "parent",
    route: "/parent/family-setup",
    owner: "UI/UX Lead + Family Domain Lead",
    docRef: "docs/ux/screens/family-setup.md",
    entryFrom: ["P-REGISTRATION"],
    exitTo: ["P-DASH"],
    // Reachable from the nav so a parent can return to add another
    // child, but it is not the first tab.
    primaryNav: false,
    states: [
      "LOADING",
      "NO_FAMILY",
      "CREATING_FAMILY",
      "FAMILY_READY_NO_CHILDREN",
      "ADDING_CHILD",
      "CHILD_ADDED",
      "PROVISIONING_CHILD_ACCESS",
      "CHILD_ACCESS_READY",
      "VALIDATION_ERROR",
      "NETWORK_ERROR",
      "OFFLINE",
    ],
  },
  "C-TODAY": {
    id: "C-TODAY",
    surface: "child",
    route: "/child/today",
    owner: "Frontend Lead",
    docRef: "docs/ux/screens/child-today.md",
    entryFrom: ["C-TASK", "C-GAME-LOBBY", "SOCIAL-CHAT"],
    exitTo: ["C-TASK", "C-GAME-LOBBY"],
    primaryNav: true,
    states: ["FIRST_DAY", "NORMAL_DAY", "ALL_COMPLETE", "OVERDUE", "OFFLINE", "NO_TASKS", "FAILED_SYNC"],
  },
  "C-TASK": {
    id: "C-TASK",
    surface: "child",
    route: "/child/task/:id",
    owner: "Frontend Lead",
    docRef: "docs/ux/screens/child-task-detail.md",
    entryFrom: ["C-TODAY", "C-CAMERA"],
    exitTo: ["C-CAMERA", "C-TODAY"],
    primaryNav: false,
    states: ["READY", "IN_PROGRESS", "WAITING_FOR_PROOF", "VERIFYING", "APPROVED", "REJECTED_WITH_EXPLANATION", "RETRYABLE_FAILURE", "OFFLINE"],
  },
  "C-CAMERA": {
    id: "C-CAMERA",
    surface: "child",
    route: "/child/task/:id/camera",
    owner: "Computer Vision Lead + Frontend Lead",
    docRef: "docs/ux/screens/camera-exercise.md",
    entryFrom: ["C-TASK"],
    exitTo: ["C-TASK"],
    primaryNav: false,
    states: ["PERMISSION", "FRAMING", "NOT_READY", "READY", "ACTIVE", "PAUSE", "LOW_CONFIDENCE", "COMPLETED", "ABORTED"],
  },
  "C-GAME-LOBBY": {
    id: "C-GAME-LOBBY",
    surface: "child",
    route: "/child/games",
    owner: "Game Engine Lead + Frontend Lead",
    docRef: "docs/ux/screens/game-lobby.md",
    entryFrom: ["C-TODAY"],
    exitTo: ["C-TODAY"],
    primaryNav: true,
    states: ["WAITING", "READY", "PARTICIPANT_JOINED", "FULL", "DECLINED", "CANCELLED", "RECONNECTING", "FINISHED"],
  },
  "P-DASH": {
    id: "P-DASH",
    surface: "parent",
    route: "/parent/dashboard",
    owner: "Frontend Lead",
    docRef: "docs/ux/screens/parent-dashboard.md",
    entryFrom: ["P-REGISTRATION", "P-FAMILY-SETUP", "P-TASK-BUILDER", "P-APPROVALS", "P-REWARDS"],
    exitTo: ["P-APPROVALS", "P-TASK-BUILDER", "P-REWARDS"],
    primaryNav: true,
    states: ["NORMAL", "NO_ACTIVITY", "CHILD_OFFLINE", "PENDING_APPROVALS", "NOTIFICATION_OVERLOAD", "MULTIPLE_CHILDREN"],
  },
  "P-TASK-BUILDER": {
    id: "P-TASK-BUILDER",
    surface: "parent",
    route: "/parent/tasks/new",
    owner: "Frontend Lead + Task Architect",
    docRef: "docs/ux/screens/parent-task-builder.md",
    entryFrom: ["P-DASH"],
    exitTo: ["P-DASH"],
    primaryNav: true,
    states: ["DRAFT", "SAVING", "VALIDATION_WARNINGS", "VALIDATION_ERROR", "PUBLISHED", "ASSIGNED", "CONFLICT", "OFFLINE"],
  },
  "P-APPROVALS": {
    id: "P-APPROVALS",
    surface: "parent",
    route: "/parent/approvals",
    owner: "Parent Experience Lead + Verification Lead",
    docRef: "docs/ux/screens/parent-approvals.md",
    entryFrom: ["P-DASH"],
    exitTo: ["P-DASH"],
    primaryNav: true,
    states: ["NEW", "ALREADY_VIEWED", "APPROVED", "RETURN_REQUESTED", "SUBMIT_ERROR"],
  },
  "P-REWARDS": {
    id: "P-REWARDS",
    surface: "parent",
    route: "/parent/rewards",
    owner: "Game Engine Lead + Frontend Lead",
    docRef: "docs/ux/screens/parent-rewards.md",
    entryFrom: ["P-DASH"],
    exitTo: ["P-DASH"],
    primaryNav: true,
    states: ["AVAILABLE", "LOCKED", "PENDING_APPROVAL", "REDEEMED", "EXPIRED", "UNAVAILABLE", "CONFLICT", "FAILED"],
  },
  "SOCIAL-CHAT": {
    id: "SOCIAL-CHAT",
    surface: "child",
    route: "/child/chat/:id",
    owner: "Social Lead + Frontend Lead",
    docRef: "docs/ux/screens/social-chat.md",
    entryFrom: ["C-TODAY"],
    exitTo: ["C-TODAY"],
    primaryNav: false,
    states: ["LOADING", "EMPTY", "ACTIVE", "SENDING", "FAILED", "MODERATED", "BLOCKED", "PERMISSION_CHANGED", "OFFLINE"],
  },
} as const satisfies Record<ScreenId, ScreenContract>;

/**
 * The literal state union a given screen declares.
 *
 * This is what makes "every declared state has a rendering path"
 * checkable instead of aspirational: a consumer keyed on
 * `ScreenStates<Id>` fails to compile the moment the contract gains a
 * state it does not handle.
 */
export type ScreenStates<Id extends ScreenId> = (typeof SCREENS)[Id]["states"][number];
