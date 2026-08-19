/**
 * Deterministic seeded PRNG (mulberry32). Not cryptographic -- this is only
 * for generating reproducible synthetic fixture data, per
 * docs/engineering/local-environment.md ("Seed scripts must be
 * deterministic").
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: () => number, items: readonly T[]): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) throw new Error("pick() called with an empty list");
  return item;
}

export function intBetween(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * A deterministic, UUID-shaped string from the seeded RNG (version nibble
 * fixed to 4, variant nibble fixed to 8 -- cosmetic, this is not a real
 * v4 UUID generator, just something @life/domain-types's branded
 * `z.string().uuid()` ids accept). Used only for synthetic fixtures
 * (P1-024): domain-types commands require a real UUID-shaped id, and
 * fixtures must stay reproducible for the same seed per
 * docs/engineering/local-environment.md ("Seed scripts must be
 * deterministic") -- `crypto.randomUUID()` would satisfy the schema but
 * not reproducibility.
 */
export function seededUuid(rng: () => number): string {
  const hex = (): string => Math.floor(rng() * 16).toString(16);
  const group = (n: number): string => Array.from({ length: n }, hex).join("");
  return `${group(8)}-${group(4)}-4${group(3)}-8${group(3)}-${group(12)}`;
}
