import type { Stage, StageEnemyEntry } from '../../core/stage/Stage'

/**
 * Chapter config - the ONLY hand-authored content per chapter (spec v3
 * D9). Everything else about the 10 floors comes from the shared rules
 * inside defineChapterStages - one owner for all floor rules.
 */
export interface ChapterConfig {
  realmId: string

  /** 1-based chapter index (mortal = 1, qi_refining = 2, foundation = 3). */
  chapter: number

  /** Exactly 10 stage ids in floor order (zone.stageIds order is kept). */
  ids: string[]

  /** Display name per floor (e.g. floor 3 -> 'Dong 3' / 'Quat 3' / 'Man 3.3'). */
  names: (floor: number) => string

  /** Flavor text per floor (1-indexed by floor). */
  descriptions: string[]

  /** Species pair per floor: common (weight 5) + elite-eligible (weight 3). */
  speciesByFloor: Array<{ common: string; elite: string }>

  /**
   * Escape hatch for floors whose pool is NOT the standard 2-species
   * pair (1-indexed by floor). Only Quat 1 uses this today - its 4-species
   * tutorial pool. The override REPLACES the standard pool for that floor,
   * so it must carry its own eliteChance entries.
   */
  poolOverrides?: Record<number, StageEnemyEntry[]>
}

/**
 * Perfect clear turn limits (spec v3 D2 - fixed values, no formula):
 * normal floors need the battle done in under 3 turns, the boss floor
 * in under 5. Tune later via playtest if needed - these are release
 * values, not placeholders.
 */
const NORMAL_PERFECT_CLEAR_TURNS = 3
const BOSS_PERFECT_CLEAR_TURNS = 5

const SPAWN_INTERVAL_SECONDS = 3

/**
 * Distribute the remainder from the LAST wave upward - matches the
 * play-tested literals (10 -> [3,3,4], 11 -> [3,4,4], 13 -> [4,4,5],
 * 14 -> [4,5,5], 17 -> [5,6,6], 18 -> [6,6,6]).
 * Do NOT use [k, k, total - 2k] - that formula is wrong for remainder 2.
 */
function splitEvenly3(total: number): [number, number, number] {
  const k = Math.floor(total / 3)
  const r = total % 3

  if (r === 0) return [k, k, k]
  if (r === 1) return [k, k, k + 1]
  return [k, k + 1, k + 1]
}

/**
 * Build the 10 stages of one chapter from its config (spec v3 D9).
 * Shared floor rules (single owner):
 * - totalEnemyCount = 9 + floor (matches all play-tested literals).
 * - floors 1-9: waves split evenly in 3; floor 10: raw [total]
 *   (effectiveWaves applies the solo-boss override downstream).
 * - pool = [common w5, elite w3 + eliteChance 0.1] on every floor.
 * - bossEnemyId ONLY on floor 10 (floor 1-9 declarations were fake
 *   metadata that made the UI badge lie on 27 nodes).
 * - perfectClearTurnLimit: 3 normal / 5 boss (D2).
 */
export function defineChapterStages(config: ChapterConfig): Stage[] {
  if (config.ids.length !== 10 || config.descriptions.length !== 10 || config.speciesByFloor.length !== 10) {
    throw new Error('defineChapterStages: a chapter must declare exactly 10 floors of content')
  }

  return config.ids.map((id, index) => {
    const floor = index + 1
    const species = config.speciesByFloor[index]!
    const totalEnemyCount = 9 + floor
    const isBossFloor = floor === 10
    const poolOverride = config.poolOverrides?.[floor]
    const enemyPool: StageEnemyEntry[] = poolOverride ?? [
      { enemyId: species.common, weight: 5 },
      { enemyId: species.elite, weight: 3, eliteChance: 0.1 },
    ]

    return {
      id,
      name: config.names(floor),
      description: config.descriptions[index]!,
      requiredRealmId: config.realmId,
      // Normalized (intended): always equals the floor. The old literals
      // left floor 1 of mortal/qi undefined - behaviorally identical,
      // since the zone order is the real unlock gate and displays read
      // `floor ?? requiredRealmLevel ?? 1`.
      requiredRealmLevel: floor,
      chapter: config.chapter,
      floor,
      enemyPool,
      totalEnemyCount,
      waves: isBossFloor ? [totalEnemyCount] : splitEvenly3(totalEnemyCount),
      spawnIntervalSeconds: SPAWN_INTERVAL_SECONDS,
      bossEnemyId: isBossFloor ? species.elite : undefined,
      perfectClearTurnLimit: isBossFloor ? BOSS_PERFECT_CLEAR_TURNS : NORMAL_PERFECT_CLEAR_TURNS,
    } satisfies Stage
  })
}
