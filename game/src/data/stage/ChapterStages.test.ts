// @vitest-environment jsdom
// Parity test (spec v3 D9): defineChapterStages must reproduce the 30
// play-tested stage literals for every field, EXCEPT the two intended
// changes: (1) perfectClearTurnLimit is NEW (3 normal / 5 boss - D2),
// (2) bossEnemyId is now only set on floor 10 (removes 27 nodes of fake
// metadata that made the UI badge lie). The chapter configs used here
// are the exact configs Stages.ts will carry after the swap.
import { describe, expect, it } from 'vitest'
import { defineChapterStages, type ChapterConfig } from './ChapterStages'
import { STAGES } from './Stages'
import type { Stage } from '../../core/stage/Stage'

function buildConfigsFromLiterals(): ChapterConfig[] {
  const byRealm = new Map<string, Stage[]>()

  for (const stage of STAGES) {
    const realmKey = stage.requiredRealmId ?? ''
    const list = byRealm.get(realmKey) ?? []
    list.push(stage)
    byRealm.set(realmKey, list)
  }

  const chapters: Array<{ realmId: string; chapter: number }> = [
    { realmId: 'qi_refining', chapter: 2 },
    { realmId: 'mortal', chapter: 1 },
    { realmId: 'foundation_establishment', chapter: 3 },
  ]

  return chapters.map(({ realmId, chapter }) => {
    const stages = byRealm.get(realmId)!.sort((a, b) => (a.floor ?? 0) - (b.floor ?? 0))

    return {
      realmId,
      chapter,
      ids: stages.map((stage) => stage.id),
      names: (floor: number) => stages[floor - 1]!.name,
      descriptions: stages.map((stage) => stage.description),
      speciesByFloor: stages.map((stage) => ({
        common: stage.enemyPool[0]!.enemyId,
        elite: stage.enemyPool[1]?.enemyId ?? stage.enemyPool[0]!.enemyId,
      })),
      poolOverrides: Object.fromEntries(
        stages
          .filter((stage) => stage.enemyPool.length !== 2)
          .map((stage) => [stage.floor!, stage.enemyPool]),
      ),
    }
  })
}

describe('defineChapterStages parity vs literals (D9)', () => {
  const built: Stage[] = buildConfigsFromLiterals().flatMap(defineChapterStages)
  const literalById = new Map(STAGES.map((stage) => [stage.id, stage]))

  it('builds exactly 30 stages with identical id order', () => {
    expect(built).toHaveLength(30)
    expect(built.map((stage) => stage.id)).toEqual(STAGES.map((stage) => stage.id))
  })

  it.each(built.map((stage) => stage.id))('%s: every shared field matches the literal', (id) => {
    const fromBuilder = built.find((stage) => stage.id === id)!
    const fromLiteral = literalById.get(id)!

    expect(fromBuilder.name).toBe(fromLiteral.name)
    expect(fromBuilder.description).toBe(fromLiteral.description)
    expect(fromBuilder.requiredRealmId).toBe(fromLiteral.requiredRealmId)
    // Normalized (intended): old literals left floor 1 of mortal/qi
    // undefined; behaviorally identical because the zone order is the
    // real gate - compare the effective value.
    expect(fromBuilder.requiredRealmLevel ?? fromBuilder.floor).toBe(fromLiteral.requiredRealmLevel ?? fromLiteral.floor)
    expect(fromBuilder.chapter).toBe(fromLiteral.chapter)
    expect(fromBuilder.floor).toBe(fromLiteral.floor)
    expect(fromBuilder.enemyPool).toEqual(fromLiteral.enemyPool)
    expect(fromBuilder.totalEnemyCount).toBe(fromLiteral.totalEnemyCount)
    expect(fromBuilder.waves).toEqual(fromLiteral.waves)
    expect(fromBuilder.spawnIntervalSeconds).toBe(fromLiteral.spawnIntervalSeconds)
  })

  it('perfectClearTurnLimit is new and fixed: 3 normal / 5 boss (D2)', () => {
    for (const stage of built) {
      if (stage.floor === 10) {
        expect(stage.perfectClearTurnLimit).toBe(5)
      } else {
        expect(stage.perfectClearTurnLimit).toBe(3)
      }
    }
  })

  it('bossEnemyId only on floor 10 (intended change: truthful metadata)', () => {
    for (const stage of built) {
      if (stage.floor === 10) {
        expect(stage.bossEnemyId).toBeDefined()
      } else {
        expect(stage.bossEnemyId).toBeUndefined()
      }
    }
  })

  it('waves sum invariant holds for all built stages', () => {
    for (const stage of built) {
      expect(stage.waves.reduce((a, b) => a + b, 0)).toBe(stage.totalEnemyCount)
    }
  })

  it('rejects a chapter that does not declare exactly 10 floors', () => {
    const valid = buildConfigsFromLiterals()[0]!

    expect(() =>
      defineChapterStages({ ...valid, ids: valid.ids.slice(0, 9) }),
    ).toThrow(/exactly 10 floors/)
  })
})
