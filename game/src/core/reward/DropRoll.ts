/**
 * Roll thuan dung chung cho moi noi can random roi do/so luong -
 * tach ra tu ExplorationSystem (truoc day co rieng 1 ban
 * randomInt() private) de ExplorationSystem lan loot-khi-giet-quai
 * (xem GameManager.grantBattleRewardIfNeeded()) dung chung 1 nguon.
 *
 * Mission C Task 8 - optional trailing `rng` param: the combat session
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
 * Random 1 gia tri theo trong so - dung cho roll pham chat trang
 * bi (xem EquipmentQuality.ts) va bat ky cho nao khac can random
 * khong deu.
 */
export function weightedRandom<T>(entries: WeightedEntry<T>[], rng: () => number = Math.random): T {
  // T8-71 - an empty table used to crash on `entries[-1]!.value` with an
  // opaque TypeError; fail loudly so the broken caller is findable.
  if (entries.length === 0) {
    throw new Error('weightedRandom: empty entries')
  }

  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0)

  // r12-AUT (sibling of drawFromPool): a NaN/Infinity entry weight is
  // invalid authored data - the roll math would stay NaN and the
  // fall-through below silently pays the LAST entry (fail-open).
  if (!Number.isFinite(totalWeight)) {
    throw new Error(`weightedRandom: entry weights must be finite (got total ${totalWeight})`)
  }

  let roll = rng() * totalWeight

  for (const entry of entries) {
    roll -= entry.weight

    if (roll <= 0) {
      return entry.value
    }
  }

  return entries[entries.length - 1]!.value
}
