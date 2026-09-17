/**
 * Roll thuần dùng chung cho mọi nơi cần random rơi đồ/số lượng —
 * tách ra từ ExplorationSystem (trước đây có riêng 1 bản
 * randomInt() private) để ExplorationSystem lẫn loot-khi-giết-quái
 * (xem GameManager.grantBattleRewardIfNeeded()) dùng chung 1 nguồn.
 *
 * Mission C Task 8 — optional trailing `rng` param: the combat session
 * threads its seeded RNG through; economy callers leave it at the
 * Math.random default (out of the session-RNG boundary).
 */
export function randomInt(min: number, max: number, rng: () => number = Math.random): number {
  const low = Math.ceil(min)

  const high = Math.floor(max)

  return Math.floor(rng() * (high - low + 1)) + low
}

export function rollChance(chance: number, rng: () => number = Math.random): boolean {
  return rng() < chance
}

export interface WeightedEntry<T> {
  value: T

  weight: number
}

/**
 * Random 1 giá trị theo trọng số — dùng cho roll phẩm chất trang
 * bị (xem EquipmentQuality.ts) và bất kỳ chỗ nào khác cần random
 * không đều.
 */
export function weightedRandom<T>(entries: WeightedEntry<T>[], rng: () => number = Math.random): T {
  // T8-71 - an empty table used to crash on `entries[-1]!.value` with an
  // opaque TypeError; fail loudly so the broken caller is findable.
  if (entries.length === 0) {
    throw new Error('weightedRandom: empty entries')
  }

  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0)

  let roll = rng() * totalWeight

  for (const entry of entries) {
    roll -= entry.weight

    if (roll <= 0) {
      return entry.value
    }
  }

  return entries[entries.length - 1]!.value
}
