/**
 * Semantic-version parsing and compatibility checks (P1-019).
 *
 * Backs docs/architecture/versioning-and-compatibility.md's rule 1
 * ("Breaking changes require a new compatible version...") for every
 * surface that publishes a plain semver string -- today that is
 * `CONTRACT_VERSION` (packages/domain-types/src/family.ts, currently
 * "0.2.0").
 */

/** @public */
export interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/u;

/** @public */
export class InvalidSemVerError extends Error {
  constructor(public readonly input: string) {
    super(`Not a valid semver string: "${input}" (expected MAJOR.MINOR.PATCH)`);
    this.name = "InvalidSemVerError";
  }
}

/**
 * Parses a strict `MAJOR.MINOR.PATCH` string. Deliberately does not accept
 * pre-release/build-metadata suffixes -- none of this repo's versioned
 * surfaces use them, and accepting an unused format silently would just
 * move a validation gap somewhere else.
 * @public
 */
export function parseSemVer(version: string): SemVer {
  const match = SEMVER_PATTERN.exec(version);
  if (!match) throw new InvalidSemVerError(version);
  const [, major, minor, patch] = match;
  return { major: Number(major), minor: Number(minor), patch: Number(patch) };
}

/** @public */
export function formatSemVer(version: SemVer): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}

/**
 * -1 if `a` < `b`, 0 if equal, 1 if `a` > `b`, comparing major then minor
 * then patch.
 * @public
 */
export function compareSemVer(a: SemVer, b: SemVer): -1 | 0 | 1 {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  return 0;
}

/**
 * Whether a consumer built against `consumerVersion` can safely talk to a
 * producer published at `producerVersion`, under ordinary semver rules:
 * majors must match (a major bump is defined as breaking by this policy),
 * and the producer must be at or above the consumer's minor/patch (a
 * producer can only have gained backward-compatible additions since the
 * consumer was built, never lost anything the consumer relies on).
 * @public
 */
export function isCompatible(consumerVersion: string, producerVersion: string): boolean {
  const consumer = parseSemVer(consumerVersion);
  const producer = parseSemVer(producerVersion);
  if (consumer.major !== producer.major) return false;
  return compareSemVer(producer, consumer) >= 0;
}
