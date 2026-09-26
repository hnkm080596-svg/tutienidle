import { describe, expect, it } from 'vitest'
import { CombatSystem } from './CombatSystem'
import { EventBus } from '../events/EventBus'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from './CombatEntity'

// Adversarial round-B reviewer scenario (QA write boundary: test-only).
// Spec D9 -- Linh Luc Ho The: DR = cap x currentMp/maxMp applied inside
// resolveAttack AFTER finalDamageMultiplier and BEFORE the absorb split.
// Attacked axes: the bypass channels (dot/flat/reaction/reflection must
// NEVER see it), LL=0, the >1 ratio clamp, cap edge, ward ordering.

function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats()

  return {
    id: 'id',
    name: 'name',
    type: 'enemy',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  }
}

function makePair(targetOverrides: (s: ReturnType<typeof createBaseStats>) => void) {
  const eventBus = new EventBus()
  const combat = new CombatSystem(eventBus)
  // deterministic: no miss rolls land (guaranteedHit), no stray rolls.
  combat.setRandomSource(() => 0.99)

  const source = createCombatant({ id: 'attacker', type: 'player' })
  source.stats.might = 100
  source.stats.criticalChance = 0

  const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })
  target.stats.defense = 0
  target.stats.blockChance = 0
  target.stats.endurancePercent = 0
  target.stats.linhLucHoTheCap = 0.25
  target.stats.maxMp = 100
  targetOverrides(target.stats)

  return { combat, source, target }
}

const HIT = { kind: 'physical', multiplier: 1 } as const
const HIT_OPTS = { guaranteedHit: true, critical: false } as const

describe('CombatSystem - Linh Luc Ho The DR (spec D9, adversarial)', () => {
  it('scales the resolved hit by live currentMp/maxMp ratio', () => {
    // 100 base (might=100, defense=0) -> DR 0.25 x (80/100=0.8) = 0.20 -> 80.
    const { combat, source, target } = makePair((s) => {
      /* cap .25, maxMp 100 */ 
    })
    target.currentMp = 80
    const result = combat.resolveActionHit(source, target, { ...HIT }, { ...HIT_OPTS })
    expect(result.finalDamage).toBeCloseTo(80, 5)
    expect(result.hpDamage).toBeCloseTo(80, 5)
  })

  it('LL = 0 -> DR = 0 (full damage lands)', () => {
    const { combat, source, target } = makePair(() => {})
    target.currentMp = 0
    const result = combat.resolveActionHit(source, target, { ...HIT }, { ...HIT_OPTS })
    expect(result.finalDamage).toBeCloseTo(100, 5)
  })

  it('mp above maxMp clamps the ratio to 1 -> DR never exceeds the cap', () => {
    const { combat, source, target } = makePair(() => {})
    target.currentMp = 250 // over-max (buff transient) -> ratio clamps
    const result = combat.resolveActionHit(source, target, { ...HIT }, { ...HIT_OPTS })
    expect(result.finalDamage).toBeCloseTo(75, 5)
  })

  it('maxMp = 0 pool -> DR cannot divide-by-zero and stays off', () => {
    const { combat, source, target } = makePair((s) => {
      s.maxMp = 0
    })
    target.currentMp = 0
    const result = combat.resolveActionHit(source, target, { ...HIT }, { ...HIT_OPTS })
    expect(result.finalDamage).toBeCloseTo(100, 5)
  })

  it('cap = 0 -> no reduction even at full LL', () => {
    const { combat, source, target } = makePair((s) => {
      s.linhLucHoTheCap = 0
    })
    target.currentMp = 100
    const result = combat.resolveActionHit(source, target, { ...HIT }, { ...HIT_OPTS })
    expect(result.finalDamage).toBeCloseTo(100, 5)
  })

  it('applies BEFORE ward absorb: the shield soaks the REDUCED damage', () => {
    const { combat, source, target } = makePair(() => {})
    target.currentMp = 100 // DR .25 -> 100 -> 75 -> ward 30 -> hp 45
    target.currentWard = 30
    const result = combat.resolveActionHit(source, target, { ...HIT }, { ...HIT_OPTS })
    expect(result.finalDamage).toBeCloseTo(75, 5)
    expect(result.wardAbsorbed + result.externalWardAbsorbed).toBeCloseTo(30, 5)
    expect(result.hpDamage).toBeCloseTo(45, 5)
    expect(target.currentWard).toBe(0)
    expect(target.currentHp).toBeCloseTo(955, 5)
  })

  it('DoT channel bypasses Ho The entirely (full raw amount)', () => {
    const { combat, source, target } = makePair(() => {})
    target.currentMp = 100
    const applied = combat.applyDotDamage({
      sourceId: source.id,
      source,
      target,
      rawDamage: 50,
      element: 'fire',
      effectId: 'hoa_an',
    })
    expect(applied).toBeCloseTo(50, 5)
    expect(target.currentHp).toBeCloseTo(950, 5)
  })

  it('flat direct channel bypasses Ho The (legacy_flat / consume lanes)', () => {
    const { combat, source, target } = makePair(() => {})
    target.currentMp = 100
    const applied = combat.applyDirectDamage(target, 50, source.id)
    expect(applied).toBeCloseTo(50, 5)
    expect(target.currentHp).toBeCloseTo(950, 5)
  })

  it('reaction channel bypasses Ho The', () => {
    const { combat, source, target } = makePair(() => {})
    target.currentMp = 100
    const applied = combat.applyReactionDamage(target, 50, source.id)
    expect(applied).toBeCloseTo(50, 5)
    expect(target.currentHp).toBeCloseTo(950, 5)
  })

  it('reflection / standard-hit channel bypasses Ho The (hit-layer only)', () => {
    const { combat, source, target } = makePair(() => {})
    target.currentMp = 100
    const applied = combat.applyModifiedDirectDamage(target, 50, source, 'reflection')
    expect(applied).toBeCloseTo(50, 5)
    expect(target.currentHp).toBeCloseTo(950, 5)
  })
})
