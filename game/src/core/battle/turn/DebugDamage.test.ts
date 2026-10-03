import { afterEach, describe, expect, it, vi } from 'vitest'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import type { CombatEntity } from '../../combat/CombatEntity'

// QA regression evidence (2026-09-04, Combat Fairness Guards) - ghi nhan
// hanh vi endurance pipeline cua he song: don damage > enduranceThreshold
// bi tru PHANG thresholdxpercent SAU moi multiplier (applyEndurance trong
// CombatSystem). Day la ly do Sudden Death test phai khong che endurance:
// scaled = (base + flat) x m - flat, KHONG phai base x m.
//
// Flaky-hygiene (2026-09-05): test do d10 roi d13/d25 o 3 lan resolveActionHit
// rieng - pipeline roll Math.random 4 lan/hit (rollHit/ignoreResistance/block/
// crit). Stats fixture da neutralize moi rate, nhung de test KHONG phu thuoc
// worker state/offset khi chay full suite, seed Math.random deterministic:
// roll nao cung tra 0 -> "khong trung moi roll" (hit roll < hitChance=1 van
// pass, cac khac deu false). Ket qua: damage 100% xac dinh giua cac run.

function mk(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, blockChance: 0, ...overrides.stats })
  return {
    id: 'x', name: 'x', type: 'enemy', baseStats: stats, stats,
    currentHp: 1_000_000, maxHp: 1_000_000, currentMp: 0,
    currentWard: 0, turnsSinceLastHitLanded: Infinity, realmIndex: 0, x: 0, row: 2, alive: true,
    ...overrides,
  } as CombatEntity
}

describe('debug damage scaling pipeline', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('measures damage at multipliers 1.0 / 1.3 / 2.5', () => {
    // 0 < moi threshold co y nghia: rollHit (hitChance = 1.0 -> 0 < 1 = hit);
    // ignoreResistance/block/crit (chance = 0 -> 0 < 0 = false).
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const combat = new CombatSystem(new EventBus())

    const run = (multiplier: number): number => {
      const source = mk({ id: 'src', stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, blockChance: 0, might: 100 }) })
      const target = mk({ id: 'tgt', stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 0, defense: 0 }) })
      const before = target.currentHp
      combat.resolveActionHit(source, target, { kind: 'physical', multiplier })
      return before - target.currentHp
    }

    const d10 = run(1)
    const d13 = run(1.3)
    const d25 = run(2.5)

    // Endurance flat-subtract model: damage(m) = (base + flat) x m - flat
    // voi base = 93 (do tai m=1), flat = threshold(10) x percent(0.7) = 7.
    const flat = 10 * 0.7
    expect(d13).toBeCloseTo((d10 + flat) * 1.3 - flat, 1)
    expect(d25).toBeCloseTo((d10 + flat) * 2.5 - flat, 1)
  })
})
