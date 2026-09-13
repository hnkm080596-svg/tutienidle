// Builder unit test for defineChapterStages (spec v3 D9). Uses one
// small hand-written ChapterConfig fixture - NOT the shipped Stages.ts
// configs - so the floor rules are verified independently of content.
import { describe, expect, it } from 'vitest'
import { defineChapterStages, type ChapterConfig } from './ChapterStages'
import type { Stage } from '../../core/stage/Stage'

const OVERRIDE_POOL = [
  { enemyId: 'override_alpha', weight: 7 },
  { enemyId: 'override_beta', weight: 2, eliteChance: 0.25 },
]

const FIXTURE: ChapterConfig = {
  realmId: 'test_realm',
  chapter: 9,
  ids: Array.from({ length: 10 }, (_, i) => `test_stage_${i + 1}`),
  names: (floor) => `Fixture Floor ${floor}`,
  descriptions: Array.from({ length: 10 }, (_, i) => `desc ${i + 1}`),
  speciesByFloor: Array.from({ length: 10 }, (_, i) => ({
    common: `f${i + 1}_common`,
    elite: `f${i + 1}_elite`,
  })),
  poolOverrides: { 3: OVERRIDE_POOL },
}

const built: Stage[] = defineChapterStages(FIXTURE)
const byFloor = new Map(built.map((stage) => [stage.floor, stage]))

describe('defineChapterStages - floor rules (spec v3 D9)', () => {
  it('builds exactly 10 stages in id order', () => {
    expect(built).toHaveLength(10)
    expect(built.map((stage) => stage.id)).toEqual(FIXTURE.ids)
  })

  it('maps chapter / floor / realm / name / description / requiredRealmLevel', () => {
    for (const stage of built) {
      expect(stage.chapter).toBe(FIXTURE.chapter)
      expect(stage.requiredRealmId).toBe(FIXTURE.realmId)
      expect(stage.requiredRealmLevel).toBe(stage.floor)
      expect(stage.name).toBe(`Fixture Floor ${stage.floor}`)
      expect(stage.description).toBe(`desc ${stage.floor}`)
    }
  })

  it('totalEnemyCount = 9 + floor on every floor', () => {
    for (const stage of built) {
      expect(stage.totalEnemyCount).toBe(9 + stage.floor!)
    }
  })

  it.each([
    [1, [3, 3, 4]],
    [2, [3, 4, 4]],
    [4, [4, 4, 5]],
    [5, [4, 5, 5]],
    [8, [5, 6, 6]],
  ] as const)('floor %i: waves split evenly in 3 -> %j', (floor, expected) => {
    expect(byFloor.get(floor)!.waves).toEqual(expected)
  })

  it('floor 10: waves = [totalEnemyCount] (solo-boss override lives downstream)', () => {
    const boss = byFloor.get(10)!
    expect(boss.waves).toEqual([boss.totalEnemyCount])
  })

  it('standard pool is [common w5, elite w3 + eliteChance 0.1]', () => {
    for (const stage of built) {
      if (stage.floor === 3) continue // overridden floor
      const species = FIXTURE.speciesByFloor[stage.floor! - 1]!
      expect(stage.enemyPool).toEqual([
        { enemyId: species.common, weight: 5 },
        { enemyId: species.elite, weight: 3, eliteChance: 0.1 },
      ])
    }
  })

  it('poolOverrides REPLACES the standard pool for that floor', () => {
    expect(byFloor.get(3)!.enemyPool).toEqual(OVERRIDE_POOL)
  })

  it('bossEnemyId = elite species on floor 10 only', () => {
    for (const stage of built) {
      if (stage.floor === 10) {
        expect(stage.bossEnemyId).toBe('f10_elite')
      } else {
        expect(stage.bossEnemyId).toBeUndefined()
      }
    }
  })

  it('perfectClearTurnLimit (rounds, D2 revised): totalEnemyCount + 10 normal / 15 boss', () => {
    for (const stage of built) {
      expect(stage.perfectClearTurnLimit).toBe(
        stage.floor === 10 ? 15 : stage.totalEnemyCount + 10,
      )
    }
  })

  it('spawnIntervalSeconds is the shared constant (3)', () => {
    for (const stage of built) {
      expect(stage.spawnIntervalSeconds).toBe(3)
    }
  })

  it('waves sum invariant holds on every floor', () => {
    for (const stage of built) {
      expect(stage.waves.reduce((a, b) => a + b, 0)).toBe(stage.totalEnemyCount)
    }
  })

  it('rejects a chapter that does not declare exactly 10 floors', () => {
    expect(() =>
      defineChapterStages({ ...FIXTURE, ids: FIXTURE.ids.slice(0, 9) }),
    ).toThrow(/exactly 10 floors/)
  })
})
