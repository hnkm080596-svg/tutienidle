// Builder unit test for defineChapterStages (spec v3 D9). Uses one
// small hand-written ChapterConfig fixture - NOT the shipped Stages.ts
// configs - so the floor rules are verified independently of content.
// BETA SCOPE LOCK v2: the fixture is a roster (3 normals + 1 boss); the
// shipped distinct-4 policy lives in BetaStageRoster.test.ts.
import { describe, expect, it } from 'vitest'
import { defineChapterStages, type ChapterConfig } from './ChapterStages'
import type { Stage } from '../../core/stage/Stage'

const FIXTURE: ChapterConfig = {
  realmId: 'test_realm',
  chapter: 9,
  ids: Array.from({ length: 10 }, (_, i) => `test_stage_${i + 1}`),
  names: (floor) => `Fixture Floor ${floor}`,
  descriptions: Array.from({ length: 10 }, (_, i) => `desc ${i + 1}`),
  roster: {
    normals: ['fixture_band_a', 'fixture_band_b', 'fixture_band_c'],
    boss: 'fixture_boss',
  },
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

  it.each([
    [1, 'fixture_band_a'],
    [3, 'fixture_band_a'],
    [4, 'fixture_band_b'],
    [6, 'fixture_band_b'],
    [7, 'fixture_band_c'],
    [9, 'fixture_band_c'],
  ] as const)('floor %i: pool is the single band species %s', (floor, species) => {
    const stage = byFloor.get(floor)!
    expect(stage.enemyPool).toHaveLength(1)
    expect(stage.enemyPool[0]!.enemyId).toBe(species)
    expect(stage.enemyPool[0]!.weight).toBe(1)
  })

  it('normal-floor eliteChance ramps 5% -> 21% (floors 1-9)', () => {
    const expected = [0.05, 0.07, 0.09, 0.11, 0.13, 0.15, 0.17, 0.19, 0.21]
    for (let floor = 1; floor <= 9; floor++) {
      expect(byFloor.get(floor)!.enemyPool[0]!.eliteChance).toBe(expected[floor - 1])
    }
  })

  it('floor 10: pool is the roster boss with the 10% elite stack chance', () => {
    expect(byFloor.get(10)!.enemyPool).toEqual([
      { enemyId: 'fixture_boss', weight: 1, eliteChance: 0.1 },
    ])
  })

  it('bossEnemyId = roster boss on floor 10 only', () => {
    for (const stage of built) {
      if (stage.floor === 10) {
        expect(stage.bossEnemyId).toBe('fixture_boss')
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

  it('stamps floorStatScales[i] onto stage.statScale (default 1)', () => {
    const scales = [1.0, 1.0, 1.3, 1.55, 1.85, 2.15, 2.45, 2.8, 3.2, 3.6]
    const scaled = defineChapterStages({ ...FIXTURE, floorStatScales: scales })
    for (const stage of scaled) {
      expect(stage.statScale).toBe(scales[stage.floor! - 1])
    }
    for (const stage of built) {
      expect(stage.statScale).toBe(1)
    }
  })

  it('rejects floorStatScales that is not 10 positive finite entries', () => {
    expect(() =>
      defineChapterStages({ ...FIXTURE, floorStatScales: [1, 2, 3] }),
    ).toThrow(/exactly 10 entries/)
    expect(() =>
      defineChapterStages({
        ...FIXTURE,
        floorStatScales: [1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
      }),
    ).toThrow(/positive finite/)
    expect(() =>
      defineChapterStages({
        ...FIXTURE,
        floorStatScales: [1, 1, 1, 1, 1, 1, 1, 1, 1, Number.NaN],
      }),
    ).toThrow(/positive finite/)
  })

  it('rejects a roster without 3 normals + boss', () => {
    expect(() =>
      defineChapterStages({
        ...FIXTURE,
        roster: { normals: ['a', 'b'] as unknown as [string, string, string], boss: 'boss' },
      }),
    ).toThrow(/roster/)
    expect(() =>
      defineChapterStages({
        ...FIXTURE,
        roster: { normals: ['a', 'b', 'c'], boss: '' },
      }),
    ).toThrow(/roster/)
  })
})
