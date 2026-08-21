/**
 * Roll thuần dùng chung cho mọi nơi cần random rơi đồ/số lượng —
 * tách ra từ ExplorationSystem (trước đây có riêng 1 bản
 * randomInt() private) để ExplorationSystem lẫn loot-khi-giết-quái
 * (xem GameManager.grantBattleRewardIfNeeded()) dùng chung 1 nguồn.
 */
export function randomInt(min: number, max: number): number {
  const low = Math.ceil(min)

  const high = Math.floor(max)

  return Math.floor(Math.random() * (high - low + 1)) + low
}

export function rollChance(chance: number): boolean {
  return Math.random() < chance
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
export function weightedRandom<T>(entries: WeightedEntry<T>[]): T {
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0)

  let roll = Math.random() * totalWeight

  for (const entry of entries) {
    roll -= entry.weight

    if (roll <= 0) {
      return entry.value
    }
  }

  return entries[entries.length - 1]!.value
}
