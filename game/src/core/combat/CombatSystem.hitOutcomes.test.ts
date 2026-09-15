import { afterEach, describe, expect, it, vi } from 'vitest'
import { CombatSystem } from './CombatSystem'
import { EventBus } from '../events/EventBus'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from './CombatEntity'

// stat-system-reimagined Task 5 (D5/D6/D11, INV-3) — three hit outcomes:
//   miss     — accuracy/dodge roll fails; nothing lands
//   absorbed — lands, ward + MP shield absorb everything (hpDamage == 0)
//   taken    — hpDamage > 0
// Only `taken` fires damage-proportional triggers: leechPercent and
// thornsPercent read hpDamage (post-absorb HP loss), never finalDamage.
// Landed (absorbed OR taken) still resets turnsSinceLastHitLanded and
// still rolls ailment application; DoT never touches any of it.

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
    currentMomentum: 0,

    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  }
}

// might 100 -> ~27 final damage through the mitigation chain (base
// defense trims it below raw might), comfortably above the small wards
// the taken/absorbed cases set.
function attacker(extra: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ might: 100, accuracyRating: 1000, criticalRate: 0, leechPercent: 0.5 })
  return createCombatant({ id: 'attacker', type: 'player', baseStats: stats, stats, currentHp: 500, maxHp: 1000, ...extra })
}

function defender(extra: Partial<CombatEntity> = {}, statOverrides: Parameters<typeof createBaseStats>[0] = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, blockChance: 0, criticalAvoidance: 0, ...statOverrides })
  return createCombatant({ id: 'defender', baseStats: stats, stats, currentHp: 1000, maxHp: 1000, ...extra })
}

const PHYSICAL_HIT = { kind: 'physical' as const, multiplier: 1 }

describe('hit outcome semantics (INV-3)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('miss: dodge returns outcome miss, zero damage, no landed-timer reset', () => {
    const combat = new CombatSystem(new EventBus())
    const source = attacker({ stats: createBaseStats({ might: 100, accuracyRating: 0, criticalRate: 0, leechPercent: 0.5 }) })
    const target = defender({ turnsSinceLastHitLanded: 5 }, { evasionRate: 1_000_000 })

    // accuracy 0 vs huge evasion -> hitChance clamps to the 5% floor;
    // force the roll above it so the miss branch is deterministic.
    vi.spyOn(Math, 'random').mockReturnValue(0.999)

    const result = combat.resolveActionHit(source, target, PHYSICAL_HIT)

    expect(result.dodged).toBe(true)
    expect(result.outcome).toBe('miss')
    expect(result.hpDamage).toBe(0)
    expect(target.turnsSinceLastHitLanded).toBe(5)
    expect(target.currentHp).toBe(1000)
  })

  it('absorbed: full ward absorb -> outcome absorbed, no thorns, no leech, timer still resets', () => {
    const combat = new CombatSystem(new EventBus())
    // leechPercent 0.2 stays under the 0.25 StatMetadata cap.
    const source = attacker({ stats: createBaseStats({ might: 100, accuracyRating: 1000, criticalRate: 0, leechPercent: 0.2 }) })
    const target = defender({ currentWard: 1000, turnsSinceLastHitLanded: 3 }, { thornsPercent: 0.5 })

    const result = combat.resolveActionHit(source, target, PHYSICAL_HIT)

    expect(result.dodged).toBe(false)
    expect(result.hpDamage).toBe(0)
    expect(result.outcome).toBe('absorbed')
    expect(result.wardAbsorbed).toBeCloseTo(result.finalDamage, 5)
    // D11: damage-proportional triggers read hpDamage — fully absorbed
    // means NOTHING for either side, even with nonzero leech/thorns.
    expect(source.currentHp).toBe(500)
    expect(source.currentHp).not.toBeLessThan(500) // no thorns kickback
    // Landed (not dodged) still delays ward regen.
    expect(target.turnsSinceLastHitLanded).toBe(0)
    expect(target.currentHp).toBe(1000)
  })

  it('taken: partial ward absorb -> thorns/leech scale on hpDamage only', () => {
    const combat = new CombatSystem(new EventBus())
    // leechPercent 0.2 (under the 0.25 cap) vs thorns 0.3: asymmetric so
    // each direction's hpDamage read stays distinguishable — net source
    // delta = hpDamage*(0.2-0.3).
    const source = attacker({ stats: createBaseStats({ might: 100, accuracyRating: 1000, criticalRate: 0, leechPercent: 0.2 }) })
    // might 100 => finalDamage ~80; ward 4 absorbs 4 -> hpDamage ~76.
    const target = defender({ currentWard: 4 }, { thornsPercent: 0.3 })

    const result = combat.resolveActionHit(source, target, PHYSICAL_HIT)

    expect(result.dodged).toBe(false)
    expect(result.outcome).toBe('taken')
    const hpDamage = result.hpDamage
    expect(hpDamage).toBeGreaterThan(0)
    expect(hpDamage).toBeCloseTo(result.finalDamage - 4, 5)

    // Thorns hits the SOURCE for 30% of hpDamage; leech heals 20% of
    // hpDamage — both on the POST-absorb number, never finalDamage.
    expect(source.currentHp).toBeCloseTo(500 + hpDamage * 0.2 - hpDamage * 0.3, 5)
    expect(target.currentHp).toBeCloseTo(1000 - hpDamage, 5)
  })

  it('overkill: hpDamage is the ACTUAL HP lost (clamped at 0), not the post-absorb amount', () => {
    const combat = new CombatSystem(new EventBus())
    const source = attacker({ stats: createBaseStats({ might: 100, accuracyRating: 1000, criticalRate: 0, leechPercent: 0.2 }) })
    // 10 HP left, no ward — post-absorb damage (~27+) far overkills.
    // D11: leech/thorns scale on the 10 HP the target REALLY lost.
    const target = defender({ currentHp: 10 }, { thornsPercent: 0.3 })

    const result = combat.resolveActionHit(source, target, PHYSICAL_HIT)

    expect(result.outcome).toBe('taken')
    expect(result.hpDamage).toBe(10)
    expect(result.targetKilled).toBe(true)
    // leech +2 (0.2 x 10), thorns -3 (0.3 x 10) — NOT ~27-scaled.
    expect(source.currentHp).toBeCloseTo(500 + 10 * 0.2 - 10 * 0.3, 5)
  })

  it('targetKilled is settled AFTER absorb+apply — a fully warded hit is never a kill', () => {
    const combat = new CombatSystem(new EventBus())
    const source = attacker()
    // currentHp 20 < finalDamage ~27: the pre-absorb prediction would
    // call this a kill; the ward absorbs everything instead.
    const target = defender({ currentHp: 20, currentWard: 1000 })

    const result = combat.resolveActionHit(source, target, PHYSICAL_HIT)

    expect(result.outcome).toBe('absorbed')
    expect(target.alive).toBe(true)
    expect(result.targetKilled).toBe(false)
  })

  it('damage event carries the explicit absorb breakdown (hpDamage, not just pre-absorb value)', () => {
    const bus = new EventBus()
    const combat = new CombatSystem(bus)
    const events: Array<{ value?: number; hpDamage?: number; wardAbsorbed?: number }> = []
    bus.on('damage', (e) => events.push(e as (typeof events)[number]))

    const source = attacker()
    const target = defender({ currentWard: 1000 })

    const result = combat.resolveActionHit(source, target, PHYSICAL_HIT)

    expect(events).toHaveLength(1)
    // `value` stays the pre-absorb impact; hpDamage reports the truth
    // (0 — fully absorbed) so presentation can tell them apart.
    expect(events[0]?.value).toBeCloseTo(result.finalDamage, 5)
    expect(events[0]?.hpDamage).toBe(0)
    expect(events[0]?.wardAbsorbed).toBeCloseTo(result.finalDamage, 5)
  })

  it('mp shield after ward: manaShieldPercent caps at 0.8 so the remainder is hpDamage (taken)', () => {
    const combat = new CombatSystem(new EventBus())
    const source = attacker()
    // manaShieldPercent hard-caps at 0.8 (StatMetadata) — an MP shield
    // alone can never fully absorb a hit; the 20% overflow lands on HP.
    const stats = createBaseStats({ evasionRate: 0, blockChance: 0, manaShieldPercent: 1 })
    const target = createCombatant({
      id: 'defender',
      baseStats: stats,
      stats,
      currentHp: 1000,
      maxHp: 1000,
      currentMp: 500,
      turnsSinceLastHitLanded: 2,
    })

    const result = combat.resolveActionHit(source, target, PHYSICAL_HIT)

    expect(result.manaShieldAbsorbed).toBeCloseTo(result.finalDamage * 0.8, 5)
    expect(result.hpDamage).toBeCloseTo(result.finalDamage - result.manaShieldAbsorbed, 5)
    expect(result.outcome).toBe('taken')
    expect(target.currentHp).toBeCloseTo(1000 - result.hpDamage, 5)
    expect(target.turnsSinceLastHitLanded).toBe(0)
  })
})

// stat-system-reimagined Task 6 (D13, INV-4) — DoT is a CLOSED economy:
// rawDamage -> dotResistancePercent (with penetration) -> HP. Nothing
// else applies — no finalDamagePercent/finalDamageReductionPercent, no
// ward/MP shield, no leech/thorns, no turnsSinceLastHitLanded touch.
describe('DoT closed economy (D13/INV-4)', () => {
  function dotTarget(statOverrides: Parameters<typeof createBaseStats>[0] = {}) {
    const stats = createBaseStats({ evasionRate: 0, ...statOverrides })
    return createCombatant({ id: 'dot_target', baseStats: stats, stats, currentHp: 10_000, maxHp: 10_000 })
  }

  it('finalDamagePercent on the attacker does not inflate DoT ticks', () => {
    const combat = new CombatSystem(new EventBus())
    const boosted = attacker()
    boosted.stats.finalDamagePercent = 0.5
    const plain = attacker({ id: 'plain' })

    const targetA = dotTarget()
    const targetB = dotTarget()

    combat.applyDotDamage({ sourceId: boosted.id, source: boosted, target: targetA, rawDamage: 100, element: 'fire', effectId: 'qa' })
    combat.applyDotDamage({ sourceId: plain.id, source: plain, target: targetB, rawDamage: 100, element: 'fire', effectId: 'qa' })

    expect(targetA.currentHp).toBeCloseTo(targetB.currentHp, 5)
    expect(targetA.currentHp).toBeCloseTo(10_000 - 100, 5)
  })

  it('finalDamageReductionPercent on the defender does not reduce DoT ticks; dotResistancePercent does', () => {
    const combat = new CombatSystem(new EventBus())
    const source = attacker()

    const reduced = dotTarget({ finalDamageReductionPercent: 0.75 })
    const resisted = dotTarget({ dotResistancePercent: 0.25 })
    const plain = dotTarget()

    combat.applyDotDamage({ sourceId: source.id, source, target: reduced, rawDamage: 100, element: 'fire', effectId: 'qa' })
    combat.applyDotDamage({ sourceId: source.id, source, target: resisted, rawDamage: 100, element: 'fire', effectId: 'qa' })
    combat.applyDotDamage({ sourceId: source.id, source, target: plain, rawDamage: 100, element: 'fire', effectId: 'qa' })

    // finalDamageReductionPercent is a HIT layer — worthless vs DoT.
    expect(reduced.currentHp).toBeCloseTo(plain.currentHp, 5)
    // dotResistancePercent is the ONLY DoT mitigation.
    expect(resisted.currentHp).toBeCloseTo(10_000 - 75, 5)
  })

  it('overkill DoT: event hpDamage is the HP actually lost, not the post-resist value', () => {
    const bus = new EventBus()
    const combat = new CombatSystem(bus)
    const events: Array<{ value?: number; hpDamage?: number }> = []
    bus.on('damage', (e) => events.push(e as (typeof events)[number]))

    const source = attacker()
    const target = dotTarget()
    target.currentHp = 5

    combat.applyDotDamage({ sourceId: source.id, source, target, rawDamage: 100, element: 'wood', effectId: 'qa' })

    expect(target.currentHp).toBe(0)
    expect(events).toHaveLength(1)
    expect(events[0]?.value).toBe(100)
    expect(events[0]?.hpDamage).toBe(5)
  })

  it('DoT never touches turnsSinceLastHitLanded, ward, or thorns/leech', () => {
    const combat = new CombatSystem(new EventBus())
    const source = attacker()
    const target = dotTarget({ thornsPercent: 0.5 })
    target.currentWard = 500
    target.turnsSinceLastHitLanded = 7
    source.stats.leechPercent = 0.25

    combat.applyDotDamage({ sourceId: source.id, source, target, rawDamage: 100, element: 'wood', effectId: 'qa' })

    expect(target.currentHp).toBeCloseTo(10_000 - 100, 5)
    expect(target.currentWard).toBe(500) // DoT bypasses ward entirely
    expect(target.turnsSinceLastHitLanded).toBe(7) // not a landed hit
    expect(source.currentHp).toBe(500) // no leech, no thorns kickback
  })
})
