// Phase-0 placeholder shapes for synthetic seed data. These are NOT the
// authoritative domain contracts -- P0-009's Phase 1 contract pack defines
// Family/ChildProfile/TaskTemplate for real. This file exists only so the
// fixture generator has something typed to produce ahead of that, and
// should be replaced by imports from packages/domain-types once P0-009
// lands.

export type VerificationStrategy =
  | "MANUAL_SELF"
  | "PARENT_APPROVAL"
  | "PHOTO_PROOF"
  | "VIDEO_PROOF"
  | "CAMERA_EXERCISE"
  | "TIMER"
  | "COUNTER"
  | "AUDIO_PROOF"
  | "COMPOSITE";

export interface SyntheticChild {
  id: string;
  displayName: string;
  age: number;
}

export interface SyntheticTask {
  id: string;
  title: string;
  verification: VerificationStrategy;
  assignedToChildId: string;
}

export interface SyntheticFamily {
  id: string;
  name: string;
  children: SyntheticChild[];
  tasks: SyntheticTask[];
}
