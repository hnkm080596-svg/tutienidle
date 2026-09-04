import { describe, expect, it } from 'vitest'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import type { CombatEntity } from '../../combat/CombatEntity'

function mk(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, blockChance: 0, ...overrides.stats }
  return {
    id: 'x', name: 'x', type: 'enemy', baseStats: stats, stats,
    currentHp: 1_000_000, maxHp: 1_000_000, currentMp: 0,
    currentSwordIntent: 0, currentMomentum: 0, currentHoaThe: 0, currentThoThe: 0, currentKimThe: 0,
    timeSinceLastBleedProc: 0, tuLucActive: false, tuLucElapsed: 0, tuLucDamageTakenPercent: 0,
    currentWard: 0, timeSinceLastHitTaken: Infinity, realmIndex: 0, x: 0, row: 2, alive: true,
    ...overrides,
  } as CombatEntity
}

describe('debug damage scaling pipeline', () => {
  it('measures damage at multipliers 1.0 / 1.3 / 2.5', () => {
    const combat = new CombatSystem(new EventBus())

    const run = (multiplier: number): number => {
      const source = mk({ id: 'src', stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, blockChance: 0, attack: 100 } })
      const target = mk({ id: 'tgt', stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0, defense: 0 } })
      const before = target.currentHp
      combat.resolveActionHit(source, target, { kind: 'physical', multiplier })
      return before - target.currentHp
    }

    const d10 = run(1)
    const d13 = run(1.3)
    const d25 = run(2.5)
    console.log('d1.0=', d10, 'd1.3=', d13, 'd2.5=', d25, 'ratios=', d13 / d10, d25 / d10)
    expect(d10).toBeGreaterThan(0)
  })
})
