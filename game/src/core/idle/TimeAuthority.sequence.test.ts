import { describe, expect, it } from 'vitest'
import { TimeAuthority } from './TimeAuthority'
import { settleIdleSkillInsightMint } from '../reward/SkillInsightBalance'

describe('authorized time sequence invariants', () => {
  it('preserves elapsed and quota across 100 seeds of 100 mixed clock actions', () => {
    const epoch = Date.UTC(2026, 9, 12)
    const dayMs = 86_400_000
    const coveredActions = new Set<number>()
    const wallDirections = new Set<number>()
    for (let seed = 1; seed <= 100; seed++) {
      let random = seed
      const next = () => (random = (Math.imul(random, 1664525) + 1013904223) >>> 0)
      let wall = epoch + dayMs
      let mono = 0
      let expectedNow = epoch
      let expectedDay = Math.floor(epoch / dayMs)
      let expectedMinted = 0
      const player = { idleSkillInsightDaily: { dayBucket: expectedDay, minted: 0 } }
      const time = new TimeAuthority({ wallNow: () => wall, monotonicNow: () => mono })
      expect(time.anchorFromServer(epoch)).toBe(true)
      for (let action = 0; action < 100; action++) {
        const operation = (next() >>> 16) % 4
        coveredActions.add(operation)
        switch (operation) {
          case 0: {
            const direction = (next() >>> 16) % 2 ? 1 : -1
            wallDirections.add(direction)
            wall += direction * dayMs
            break
          }
          case 1: {
            const elapsed = next() % (dayMs + 1)
            mono += elapsed
            expectedNow += elapsed
            break
          }
          case 2: time.rebase(expectedNow - (next() % dayMs)); break
          case 3: {
            const ahead = next() % dayMs
            time.rebase(expectedNow + ahead)
            expectedNow += ahead
          }
        }
        expect(time.now(), `seed=${seed}, action=${action}`).toBe(expectedNow)
        const day = Math.floor(expectedNow / dayMs)
        if (day > expectedDay) { expectedDay = day; expectedMinted = 0 }
        const requested = next() % 40_001
        const granted = Math.min(requested, 30_000 - expectedMinted)
        expectedMinted += granted
        expect(settleIdleSkillInsightMint(player, 'qi_refining', requested, time.now())).toBe(granted)
        expect(player.idleSkillInsightDaily).toEqual({ dayBucket: expectedDay, minted: expectedMinted })
      }
    }
    expect([...coveredActions].sort()).toEqual([0, 1, 2, 3])
    expect([...wallDirections].sort()).toEqual([-1, 1])
  })
})
