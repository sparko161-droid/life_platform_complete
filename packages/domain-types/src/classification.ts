/**
 * Sensitivity classification per docs/security/data-classification.md, which
 * landed after the initial P0-009 contract pack was written (see
 * docs/planning/change-log.md 0.5). Every schema in this package now ships
 * a companion classification map so "a reviewer can identify the class,
 * owner, storage location, access policy and retention behavior for every
 * new data field" (that doc's acceptance criterion) is checkable, not just
 * aspirational -- test/classification.test.ts asserts every schema key has
 * an entry and every entry maps to a real schema key.
 */
export const DATA_CLASSES = [
  "PUBLIC",
  "FAMILY",
  "CHILD_PRIVATE",
  "PARENT_PRIVATE",
  "SENSITIVE",
  "SECRET",
] as const;
export type DataClass = (typeof DATA_CLASSES)[number];

/** One classification entry per field of a schema. */
export type ClassificationMap<Keys extends string> = Record<Keys, DataClass>;
