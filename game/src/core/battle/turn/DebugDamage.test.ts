import { afterEach, describe, expect, it, vi } from 'vitest'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import type { CombatEntity } from '../../combat/CombatEntity'

// QA regression evidence (2026-09-04, Combat Fairness Guards) — ghi nhận
// hành vi endurance pipeline của hệ sống: đòn damage > enduranceThreshold
// bị trừ PHẲNG threshold×percent SAU mọi multiplier (applyEndurance trong
// CombatSystem). Đây là lý do Sudden Death test phải khống chế endurance:
// scaled = (base + flat) × m − flat, KHÔNG phải base × m.
//
// Flaky-hygiene (2026-09-05): test đo d10 rồi d13/d25 ở 3 lần resolveActionHit
// riêng — pipeline roll Math.random 4 lần/hit (rollHit/ignoreResistance/block/
// crit). Stats fixture đã neutralize mọi rate, nhưng để test KHÔNG phụ thuộc
// worker state/offset khi chạy full suite, seed Math.random deterministic:
// roll nào cũng trả 0 → "không trúng mọi概率 roll" (hit roll < hitChance=1 vẫn
// pass, các概率 khác đều false). Kết quả: damage 100% xác định giữa các run.

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
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('measures damage at multipliers 1.0 / 1.3 / 2.5', () => {
    // 0 < mọi threshold có ý nghĩa: rollHit (hitChance = 1.0 → 0 < 1 = hit);
    // ignoreResistance/block/crit (chance = 0 → 0 < 0 = false).
    vi.spyOn(Math, 'random').mockReturnValue(0)

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

    // Endurance flat-subtract model: damage(m) = (base + flat) × m − flat
    // với base = 93 (đo tại m=1), flat = threshold(10) × percent(0.7) = 7.
    const flat = 10 * 0.7
    expect(d13).toBeCloseTo((d10 + flat) * 1.3 - flat, 1)
    expect(d25).toBeCloseTo((d10 + flat) * 2.5 - flat, 1)
  })
})
