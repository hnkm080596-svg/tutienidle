import { describe, expect, it } from 'vitest'
import { STAGES } from './Stages'
import { ENEMIES } from '../enemy/Enemies'
import { QI_REFINING_BREAKTHROUGH_STAGE_ID } from '../../core/realm/realmSystem'

describe('stage encounter scaling', () => {
  // M-QI-02 (QI-D5): the Truc Co admission gate pins this exact id - a
  // stage rename without updating the constant would silently close the
  // breakthrough forever.
  it('QI_REFINING_BREAKTHROUGH_STAGE_ID resolves to the qi_refining chapter-final stage', () => {
    const stage = STAGES.find((candidate) => candidate.id === QI_REFINING_BREAKTHROUGH_STAGE_ID)

    expect(stage).toBeDefined()
    expect(stage!.requiredRealmId).toBe('qi_refining')
    expect(stage!.floor).toBe(10)
  })

  it('tăng tuyến tính số quái từ tầng 1 đến tầng 10 ở mọi chapter', () => {
    for (const chapter of [1, 2, 3]) {
      const stages = STAGES.filter((stage) => stage.chapter === chapter).sort(
        (left, right) => (left.floor ?? 0) - (right.floor ?? 0),
      )

      expect(stages).toHaveLength(10)
      expect(stages.map((stage) => stage.totalEnemyCount)).toEqual(
        Array.from({ length: 10 }, (_, index) => 10 + index),
      )
    }
  })

  it('gán đầy đủ tầng hiển thị, kể cả tầng đầu vốn bỏ trống requiredRealmLevel', () => {
    expect(STAGES.every((stage) => stage.floor !== undefined)).toBe(true)
  })
})

describe('foundation stages', () => {
  it('stage chương 3 không còn clone enemy pool chương 2', () => {
    const foundation = STAGES.filter((stage) => stage.chapter === 3)
    const qi = STAGES.filter((stage) => stage.chapter === 2)
    const foundationIds = new Set(foundation.flatMap((stage) => [
      ...stage.enemyPool.map((entry) => entry.enemyId),
      ...(stage.bossEnemyId ? [stage.bossEnemyId] : []),
    ]))
    const qiIds = new Set(qi.flatMap((stage) => [
      ...stage.enemyPool.map((entry) => entry.enemyId),
      ...(stage.bossEnemyId ? [stage.bossEnemyId] : []),
    ]))
    for (const id of foundationIds) {
      expect(qiIds.has(id)).toBe(false)
    }
  })

  it('mọi enemyId/bossEnemyId của chương 3 tồn tại trong ENEMIES', () => {
    const ids = new Set(ENEMIES.map((enemy) => enemy.id))
    for (const stage of STAGES.filter((s) => s.chapter === 3)) {
      for (const entry of stage.enemyPool) {
        expect(ids.has(entry.enemyId)).toBe(true)
      }
      if (stage.bossEnemyId) expect(ids.has(stage.bossEnemyId)).toBe(true)
    }
  })

  it('stage chương 3 mỗi tầng có requiredRealmLevel bằng floor', () => {
    for (const stage of STAGES.filter((s) => s.chapter === 3)) {
      expect(stage.requiredRealmLevel).toBe(stage.floor)
    }
  })

  it('foundation_floor_10 có boss đúng', () => {
    const boss = STAGES.find((stage) => stage.id === 'foundation_floor_10')!
    expect(boss.bossEnemyId).toBe('foundation_ferocious_flood_dragon_whelp')
  })

  it('chương 3: tầng chẵn dùng biến thể ferocious, tầng lẻ dùng bản thường', () => {
    for (const stage of STAGES.filter((s) => s.chapter === 3)) {
      const ids = stage.enemyPool.map((entry) => entry.enemyId)

      if ((stage.floor ?? 0) % 2 === 0) {
        for (const id of ids) expect(id).toContain('_ferocious_')
      } else {
        for (const id of ids) expect(id).not.toContain('_ferocious_')
      }
    }
  })
})

// Spec v3 D2/D9 (2026-09-11): STAGES is built by defineChapterStages -
// one owner for the floor rules. These lock the intended differences
// vs the old literals: perfectClearTurnLimit in rounds (normal =
// totalEnemyCount + 10, boss = 15 - D2 revised) and bossEnemyId only
// on floor 10 (no more fake badges on 27 nodes).
describe('builder swap (spec v3)', () => {
  it('perfectClearTurnLimit is fixed (rounds, D2 revised): totalEnemyCount + 10 normal, 15 boss', () => {
    for (const stage of STAGES) {
      if (stage.floor === 10) {
        expect(stage.perfectClearTurnLimit).toBe(15)
      } else {
        expect(stage.perfectClearTurnLimit).toBe(stage.totalEnemyCount + 10)
      }
    }
  })

  it('bossEnemyId exists only on floor 10 (fixes false badges)', () => {
    for (const stage of STAGES) {
      if (stage.floor === 10) {
        expect(stage.bossEnemyId).toBeDefined()
      } else {
        expect(stage.bossEnemyId).toBeUndefined()
      }
    }
  })

  it('eliteChance entries intact on all 30 stages', () => {
    let count = 0

    for (const stage of STAGES) {
      for (const entry of stage.enemyPool) {
        if (entry.eliteChance !== undefined) {
          expect(entry.eliteChance).toBe(0.1)
          count++
        }
      }
    }

    expect(count).toBe(30)
  })

  it('waves sum invariant holds for all 30 stages', () => {
    for (const stage of STAGES) {
      expect(stage.waves.reduce((a, b) => a + b, 0)).toBe(stage.totalEnemyCount)
    }
  })
})
