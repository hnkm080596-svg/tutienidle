import type { Stage, StageEnemyEntry } from '../../core/stage/Stage'

/**
 * Chapter config - the ONLY hand-authored content per chapter (spec v3
 * D9). Everything else about the 10 floors comes from the shared rules
 * inside defineChapterStages - one owner for all floor rules.
 *
 * BETA SCOPE LOCK v2: a chapter declares exactly one ROSTER - three
 * distinct normal species (floor bands A/B/C) and one act boss - so the
 * stage domain data IS the allow-list: no stage can roll a species that
 * is not on its act roster. Difficulty climbs via the enemy-count
 * ladder, wave shape, and the elite-chance ramp - never via new
 * species. "Hung" elites stay a runtime modifier (tinh_anh tag), not an
 * identity.
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

  /**
   * The act roster: three DISTINCT normal species on the floor bands
   * 1-3 / 4-6 / 7-9 (in that order), and the act boss fought on
   * floor 10. The boss is a fourth identity, not a band species.
   */
  roster: {
    normals: [string, string, string]
    boss: string
  }
}

/**
 * Perfect clear limits (spec v3 D2, revised 2026-09-12 - counted in ATB
 * ROUNDS via battle.roundsElapsed, not actor actions):
 * - normal floors: totalEnemyCount + NORMAL_PERFECT_CLEAR_ROUND_MARGIN
 *   (floor 1 = 20 ... floor 9 = 28). Measured best-case rounds were
 *   7/16/21 on floors 1/5/9 and a 3-hit-per-kill run needed 14/17/22,
 *   so a flat limit could never fit every floor - the +10 margin over
 *   the enemy count keeps a flawless-but-not-perfect run earnable.
 * - boss floor: a fixed 15 rounds (measured ~13 for a 3-hit boss kill).
 * Evidence: docs/qa/2026-09-12-pc-tag-system-quick.md. Release values,
 * not placeholders - tune later via playtest if needed.
 */
const NORMAL_PERFECT_CLEAR_ROUND_MARGIN = 10
const BOSS_PERFECT_CLEAR_ROUNDS = 15

const SPAWN_INTERVAL_SECONDS = 3

/** Tin-tinh (elite) tag roll for the boss pool entry (spec v3 2.2). */
const BOSS_ELITE_CHANCE = 0.1

/**
 * Elite-chance ramp - the authored difficulty dial for normal floors.
 * With one roster species per floor, difficulty leans on the count
 * ladder and this ramp: deeper floors roll the tinh_anh stat-multiplier
 * tag more often (5% on floor 1 up to 21% on floor 9). Values are whole
 * percents to keep floating-point comparisons exact.
 */
function eliteChanceForFloor(floor: number): number {
  return (5 + (floor - 1) * 2) / 100
}

/** Map a floor to its roster band species (floors 1-9; 10 is the boss). */
function bandSpeciesForFloor(config: ChapterConfig, floor: number): string {
  if (floor <= 3) return config.roster.normals[0]
  if (floor <= 6) return config.roster.normals[1]
  return config.roster.normals[2]
}

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
 * - floors 1-9: single-species pool [roster band w1 + eliteChance
 *   ramp]; floor 10: [roster boss w1 + eliteChance 0.1].
 * - bossEnemyId ONLY on floor 10 (floor 1-9 declarations were fake
 *   metadata that made the UI badge lie on 27 nodes).
 * - perfectClearTurnLimit in ROUNDS: totalEnemyCount + 10 normal /
 *   15 boss (D2 revised).
 */
export function defineChapterStages(config: ChapterConfig): Stage[] {
  // Shape validation only. Roster distinctness is a content policy for
  // shipped chapters, enforced by the data census test - fixtures may
  // legitimately repeat one species across bands.
  if (config.roster.normals.length !== 3 || !config.roster.boss) {
    throw new Error('defineChapterStages: roster must declare 3 normals + 1 boss')
  }
  if (config.ids.length !== 10 || config.descriptions.length !== 10) {
    throw new Error('defineChapterStages: a chapter must declare exactly 10 floors of content')
  }

  return config.ids.map((id, index) => {
    const floor = index + 1
    const totalEnemyCount = 9 + floor
    const isBossFloor = floor === 10
    const enemyPool: StageEnemyEntry[] = isBossFloor
      ? [{ enemyId: config.roster.boss, weight: 1, eliteChance: BOSS_ELITE_CHANCE }]
      : [{ enemyId: bandSpeciesForFloor(config, floor), weight: 1, eliteChance: eliteChanceForFloor(floor) }]

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
      bossEnemyId: isBossFloor ? config.roster.boss : undefined,
      perfectClearTurnLimit: isBossFloor
        ? BOSS_PERFECT_CLEAR_ROUNDS
        : totalEnemyCount + NORMAL_PERFECT_CLEAR_ROUND_MARGIN,
    } satisfies Stage
  })
}
