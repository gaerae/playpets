// The limits the backend keeps to (src-tauri/src/pets/mod.rs limits(): friends, a personality's
// length, seeds kept, gifts in the yard, the friendship levels). The page reads them from the state
// the backend sends; these are the same values for the moment before it has, and a test keeps them
// equal to the backend's (tests/limits.test.mjs).
export const LIMITS = {
  trees: 12,
  treesPerWorld: 3,
  treeYoungMs: 7200000,
  treeMatureMs: 43200000,
  digCooldownMs: 8000,
  digTtlMs: 86400000,
  digHistory: 32,
  digOdds: { empty: 40, seed: 25, common: 30, uncommon: 5 },
  pets: 12,
  persona: 400,
  seeds: 20,
  decor: 12,
  bondLevels: [0, 60, 200, 500, 1000],
};
/** A limit as the backend sent it in `data`, or its usual value before then. */
export const limit = (data, name) => data.limits?.[name] ?? LIMITS[name];
