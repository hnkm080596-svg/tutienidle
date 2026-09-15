import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CombatSystem } from './CombatSystem'
import { EventBus } from '../events/EventBus'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from './CombatEntity'

// R3 re-audit (AR-03 gap) — SkillToTurnSkillConverter used to drop
// attributeScaling/manaScalingRatio/swordIntentDamageRatio entirely, and
// no live turn-combat code path ever read source.stats.skillDamagePercent.
// This meant every Pháp Tu/Kiếm Trận skill's authored scaling and the
// entire skillDamagePercent stat had zero effect once cast through the
// active TurnBattleSystem. These tests prove resolveActionHit() now
// applies both, deterministically (evasionRate/criticalRate/blockChance
// all zeroed so only the scaling math under test can move the result).

function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = {
    ...createBaseStats(),
    evasionRate: 0,
    dexterity: 0,
    criticalRate: 0,
    blockChance: 0,
    might: 100,
  }

  return {
    id: 'id',
    name: 'name',
    type: 'enemy',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentSwordIntent: 0,
    currentMomentum: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    timeSinceLastBleedProc: 0,
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  }
}

describe('CombatSystem.resolveActionHit — skill scaling (R3 re-audit)', () => {
  // Pin RNG deterministically — hit/crit/block/ignore-resistance rolls all
  // consume Math.random(); a low fixed value guarantees hit (chance is
  // always > 0 with evasion 0) and no crit/block/ignore-resistance (all
  // zeroed chances) regardless of what the surrounding suite run order
  // otherwise does to shared RNG state.
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('applies attributeScaling from ActionDamageInfo.scaling against the live source stat', () => {
    const combat = new CombatSystem(new EventBus())

    const source = createCombatant({
      id: 'source',
      type: 'player',
      stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, blockChance: 0, might: 100, attunement: 50 }),
    })
    const target = createCombatant({ id: 'target', currentHp: 100000, maxHp: 100000, stats: createBaseStats({ evasionRate: 0, defense: 0, enduranceThreshold: 0, blockChance: 0 }) })

    const withoutScaling = combat.resolveActionHit(source, target, { kind: 'physical', multiplier: 1 }, { critical: false })

    const target2 = createCombatant({ id: 'target2', currentHp: 100000, maxHp: 100000, stats: createBaseStats({ evasionRate: 0, defense: 0, enduranceThreshold: 0, blockChance: 0 }) })
    const withScaling = combat.resolveActionHit(
      source,
      target2,
      { kind: 'physical', multiplier: 1, scaling: { attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }] } },
      { critical: false },
    )

    // ratioPerPoint 0.004 × attunement 50 = 0.2 bonus multiplier.
    expect(withScaling.finalDamage).toBeCloseTo(withoutScaling.finalDamage * 1.2, 5)
  })

  it('applies manaScalingRatio against the live source maxMp', () => {
    const combat = new CombatSystem(new EventBus())

    const source = createCombatant({
      id: 'source',
      type: 'player',
      stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, blockChance: 0, might: 100, maxMp: 200 }),
    })
    const target = createCombatant({ id: 'target', currentHp: 100000, maxHp: 100000, stats: createBaseStats({ evasionRate: 0, defense: 0, enduranceThreshold: 0, blockChance: 0 }) })

    const result = combat.resolveActionHit(
      source,
      target,
      { kind: 'physical', multiplier: 1, scaling: { manaScalingRatio: 0.001 } },
      { critical: false },
    )

    // baseDamage 100 × (1 + 0.001×200) = 120.
    expect(result.finalDamage).toBeCloseTo(120, 5)
  })

  it('applies swordIntentDamageRatio against the live source currentSwordIntent', () => {
    const combat = new CombatSystem(new EventBus())

    const source = createCombatant({
      id: 'source',
      type: 'player',
      stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, blockChance: 0, might: 100 }),
      currentSwordIntent: 500,
    })
    const target = createCombatant({ id: 'target', currentHp: 100000, maxHp: 100000, stats: createBaseStats({ evasionRate: 0, defense: 0, enduranceThreshold: 0, blockChance: 0 }) })

    const result = combat.resolveActionHit(
      source,
      target,
      { kind: 'physical', multiplier: 1, scaling: { swordIntentDamageRatio: 0.0002 } },
      { critical: false },
    )

    // baseDamage 100 × (1 + 0.0002×500) = 110.
    expect(result.finalDamage).toBeCloseTo(110, 5)
  })

  it('applies source.stats.skillDamagePercent even with no ActionDamageInfo.scaling', () => {
    const combat = new CombatSystem(new EventBus())

    const source = createCombatant({
      id: 'source',
      type: 'player',
      stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, blockChance: 0, might: 100, skillDamagePercent: 0.5 }),
    })
    const target = createCombatant({ id: 'target', currentHp: 100000, maxHp: 100000, stats: createBaseStats({ evasionRate: 0, defense: 0, enduranceThreshold: 0, blockChance: 0 }) })

    const result = combat.resolveActionHit(source, target, { kind: 'physical', multiplier: 1 }, { critical: false })

    // baseDamage 100 × (1 + 0.5) = 150.
    expect(result.finalDamage).toBeCloseTo(150, 5)
  })
})
