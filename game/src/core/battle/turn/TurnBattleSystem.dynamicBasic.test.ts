import { describe, expect, it, vi } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import { BuffPool } from '../../buff/BuffPool'
import type { BuffDefinition, BuffDefinitionCatalog } from '../../buff/BuffTypes'
import type { CombatEntity } from '../../combat/CombatEntity'
import type { TurnSkillDefinition } from './TurnSkillAction'

// Kiem Tu Reimagined Task 2 — generic engine primitives:
// guaranteedHit / resolved armor policy / damageMultiplier on
// resolveActionHit; `instances` + `dynamicBasic` on TurnSkillDefinition/
// TurnBattleParticipant; resolveDeclaredHit extraction; applyActionImpact
// extraImpacts; forced dynamic_basic manual choice.

const TOUGHNESS_BUFF: BuffDefinition = {
  id: 'qa_toughness',
  name: 'QA Toughness',
  polarity: 'buff',
  duration: 3,
  stackMode: 'refresh',
  effects: [],
}

const REGISTRY: BuffDefinitionCatalog = {
  get: (id: string): BuffDefinition => {
    if (id === TOUGHNESS_BUFF.id) return TOUGHNESS_BUFF
    throw new Error(`unknown buff id: ${id}`)
  },
}

function makeEntity(id: string, overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, ...overrides.stats })
  return {
    id,
    name: id,
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: 1_000_000,
    maxHp: 1_000_000,
    currentMp: stats.maxMp,
    currentThe: 0,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  } as CombatEntity
}

function makeParticipant(id: string, entity: CombatEntity, priority: number): TurnBattleParticipant {
  return {
    id,
    entity,
    speed: entity.stats.speed,
    priority,
    actionGauge: 0,
    alive: entity.alive,
    buffs: new BuffPool(),
    consecutiveHardCcTurns: 0,
  }
}

function makeBattle(extra?: (attacker: TurnBattleParticipant) => void) {
  const eventBus = new EventBus()
  const combat = new CombatSystem(eventBus)
  const system = new TurnBattleSystem(combat, 10, REGISTRY)

  const attacker = makeEntity('attacker', {
    stats: createBaseStats({ might: 100, accuracyRating: 9999 }),
  })
  const defender = makeEntity('defender', {
    // stats.maxHp drives the live vitals ceiling via refreshParticipantStats
    // (entity.maxHp = stats.maxHp + currentHp clamp), so a tanky fixture
    // must raise baseStats.maxHp, not only the entity-level field.
    stats: createBaseStats({ evasionRate: 0, maxHp: 1_000_000 }),
  })

  const attackerP = makeParticipant('attacker', attacker, 0)
  const defenderP = makeParticipant('defender', defender, 1)

  attackerP.basic = {
    id: 'strike',
    cooldownTurns: 0,
    damage: { kind: 'physical', multiplier: 1 },
    targeting: { shape: 'single' },
  }

  extra?.(attackerP)

  const battle: TurnBattle = {
    players: [attackerP],
    enemies: [defenderP],
    state: 'fighting',
  }

  return { system, battle, attackerP, defenderP, eventBus }
}

describe('Task 2 — resolveActionHit options', () => {
  it('guaranteedHit lands even when the hit roll would dodge', () => {
    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)
    const attacker = makeEntity('a', { stats: createBaseStats({ accuracyRating: 0 }) })
    const defender = makeEntity('d', { stats: createBaseStats({ evasionRate: 99999 }) })

    vi.spyOn(Math, 'random').mockReturnValue(0.99)

    const result = combat.resolveActionHit(attacker, defender, { kind: 'physical', multiplier: 1 }, { guaranteedHit: true })

    expect(result.dodged).toBe(false)
    expect(result.finalDamage).toBeGreaterThan(0)
    vi.restoreAllMocks()
  })

  it('armorBypass ignores physical mitigation entirely; armorPierceFraction reduces it', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)
    const attacker = makeEntity('a', { stats: createBaseStats({ might: 1000, accuracyRating: 9999 }) })
    // endurancePercent 0 keeps the post-armor pipeline linear so the
    // ordering assertion isolates the armor term.
    const armored = makeEntity('d', { stats: createBaseStats({ defense: 500, endurancePercent: 0, enduranceThreshold: 0, blockChance: 0 }) })
    const unarmored = makeEntity('d2', { stats: createBaseStats({ defense: 0, endurancePercent: 0, enduranceThreshold: 0, blockChance: 0 }) })

    const normal = combat.resolveActionHit(attacker, armored, { kind: 'physical', multiplier: 1 }, { critical: false })
    const pierced = combat.resolveActionHit(attacker, armored, { kind: 'physical', multiplier: 1 }, { critical: false, armorPierceFraction: 0.5 })
    const bypassed = combat.resolveActionHit(attacker, armored, { kind: 'physical', multiplier: 1 }, { critical: false, armorBypass: true })
    const naked = combat.resolveActionHit(attacker, unarmored, { kind: 'physical', multiplier: 1 }, { critical: false })

    expect(pierced.finalDamage).toBeGreaterThan(normal.finalDamage)
    expect(bypassed.finalDamage).toBeGreaterThan(pierced.finalDamage)
    // Full bypass == hitting a zero-defense target.
    expect(bypassed.finalDamage).toBe(naked.finalDamage)
    vi.restoreAllMocks()
  })

  it('damageMultiplier scales the hit (execute payload)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)
    const attacker = makeEntity('a', { stats: createBaseStats({ might: 100, accuracyRating: 9999 }) })
    // defense/endurance/block zeroed so final damage is exactly linear in
    // the multiplier.
    const defender = makeEntity('d', { stats: createBaseStats({ defense: 0, endurancePercent: 0, enduranceThreshold: 0, blockChance: 0 }) })

    const base = combat.resolveActionHit(attacker, defender, { kind: 'physical', multiplier: 1 }, { critical: false })
    const doubled = combat.resolveActionHit(attacker, defender, { kind: 'physical', multiplier: 1 }, { critical: false, damageMultiplier: 2 })

    expect(doubled.finalDamage).toBeCloseTo(base.finalDamage * 2, 5)
    vi.restoreAllMocks()
  })
})

describe('Task 2 — instances + dynamicBasic', () => {
  it('instances.count resolves N independent hits per target', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { system, battle, attackerP, eventBus } = makeBattle()

    attackerP.basic = {
      id: 'triple',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      instances: { count: 3 },
    }

    let hits = 0
    eventBus.on('damage', () => {
      hits += 1
    })

    system.resolveNextStep(battle)

    expect(hits).toBe(3)
    vi.restoreAllMocks()
  })

  it('every instance routes through CombatSystem.resolveActionHit', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { system, battle, attackerP } = makeBattle()

    attackerP.basic = {
      id: 'triple',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      instances: { count: 3 },
    }

    const combat = (system as unknown as { combat: CombatSystem }).combat
    const orig = combat.resolveActionHit.bind(combat)
    const spy = vi.fn((...args: Parameters<typeof orig>) => orig(...args))
    ;(combat as { resolveActionHit: typeof orig }).resolveActionHit = spy

    system.resolveNextStep(battle)

    expect(spy.mock.calls.length).toBe(3)
    vi.restoreAllMocks()
  })

  it('instance loop breaks when the target dies mid-sequence', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { system, battle, attackerP, defenderP, eventBus } = makeBattle()

    defenderP.entity.currentHp = 1

    attackerP.basic = {
      id: 'triple',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      instances: { count: 5 },
    }

    let hits = 0
    eventBus.on('damage', () => {
      hits += 1
    })

    system.resolveNextStep(battle)

    expect(hits).toBe(1)
    expect(defenderP.entity.alive).toBe(false)
    vi.restoreAllMocks()
  })

  it('perInstanceOptions receives (index, liveTarget) per instance', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { system, battle, attackerP, defenderP } = makeBattle()

    const seen: Array<[number, number]> = []

    attackerP.basic = {
      id: 'triple',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      instances: {
        count: 2,
        perInstanceOptions: (index, target) => {
          seen.push([index, target.currentHp])
          return {}
        },
      },
    }

    system.resolveNextStep(battle)

    expect(seen).toEqual([
      [0, defenderP.entity.maxHp],
      [1, expect.any(Number)],
    ])
    expect(seen[1]![1]).toBeLessThan(defenderP.entity.maxHp)
    vi.restoreAllMocks()
  })

  it('dynamicBasic.resolveBasic replaces the static participant.basic in auto selection', () => {
    const { system, battle, attackerP } = makeBattle()

    const orbDef: TurnSkillDefinition = {
      id: 'orb_chem',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1.2 },
      targeting: { shape: 'single' },
    }

    const resolveBasic = vi.fn().mockReturnValue(orbDef)
    attackerP.dynamicBasic = { resolveBasic }

    const step = system.resolveNextStep(battle)

    expect(resolveBasic).toHaveBeenCalledTimes(1)
    expect(step.skillId).toBe('orb_chem')
  })

  it('forced {kind:"dynamic_basic", defId} resolves via resolveManualPick without calling resolveBasic', () => {
    const { system, battle, attackerP } = makeBattle()

    const orbChem: TurnSkillDefinition = {
      id: 'orb_chem',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1.2 },
      targeting: { shape: 'single' },
    }

    const resolveBasic = vi.fn().mockReturnValue({
      id: 'orb_dam',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
    } satisfies TurnSkillDefinition)

    const resolveManualPick = vi.fn((defId: string) => (defId === 'orb_chem' ? orbChem : null))
    attackerP.dynamicBasic = { resolveBasic, resolveManualPick }

    const actor = system.peekNextActor(battle)!
    const step = system.resolveActorTurn(battle, actor, { kind: 'dynamic_basic', defId: 'orb_chem' })

    expect(resolveManualPick).toHaveBeenCalledWith('orb_chem')
    expect(resolveBasic).not.toHaveBeenCalled()
    expect(step.skillId).toBe('orb_chem')
  })

  it('invalid manual defId falls back to normal selection', () => {
    const { system, battle, attackerP } = makeBattle()

    attackerP.dynamicBasic = {
      resolveBasic: () => ({
        id: 'orb_dam',
        cooldownTurns: 0,
        damage: { kind: 'physical', multiplier: 1 },
        targeting: { shape: 'single' },
      }),
      resolveManualPick: () => null,
    }

    const actor = system.peekNextActor(battle)!
    const step = system.resolveActorTurn(battle, actor, { kind: 'dynamic_basic', defId: 'bogus' })

    expect(step.skillId).toBe('orb_dam')
  })

  it('onCastResolved fires with resolvedSkillId; returned defs become extraImpacts', () => {
    const { system, battle, attackerP } = makeBattle()

    const comboHit: TurnSkillDefinition = {
      id: 'combo_extra',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 2 },
      targeting: { shape: 'single' },
      presetId: 'kiem_combo_flash' as TurnSkillDefinition['presetId'],
    }

    const seenCtx: string[] = []
    attackerP.dynamicBasic = {
      resolveBasic: () => attackerP.basic!,
      onCastResolved: (ctx) => {
        seenCtx.push(ctx.resolvedSkillId)
        return [comboHit]
      },
    }

    const declared = system.declareActorAction(battle, attackerP)
    const result = system.applyActionImpact(battle, declared)

    expect(seenCtx).toEqual(['strike'])
    expect(result.extraImpacts).toHaveLength(1)
    expect(result.extraImpacts[0]!.presetId).toBe('kiem_combo_flash')
    expect(result.extraImpacts[0]!.landedTargetIds).toContain('defender')
  })

  it('ctx.resolveBuff applies a buff through the registry', () => {
    const { system, battle, attackerP } = makeBattle()

    attackerP.dynamicBasic = {
      resolveBasic: () => attackerP.basic!,
      onCastResolved: (ctx) => {
        ctx.resolveBuff(attackerP, { definitionId: 'qa_toughness', duration: 5 })
        return []
      },
    }

    const declared = system.declareActorAction(battle, attackerP)
    system.applyActionImpact(battle, declared)

    expect(attackerP.buffs.getAllById('qa_toughness')).toHaveLength(1)
  })

  it('manual pick and auto resolve of the same def produce identical resolution', () => {
    const manual = makeBattle()
    const auto = makeBattle()

    const orbDef: TurnSkillDefinition = {
      id: 'orb_bo',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1.8 },
      targeting: { shape: 'single' },
    }

    manual.attackerP.dynamicBasic = {
      resolveBasic: () => orbDef,
      resolveManualPick: (defId) => (defId === 'orb_bo' ? orbDef : null),
    }
    auto.attackerP.dynamicBasic = { resolveBasic: () => orbDef }

    const manualActor = manual.system.peekNextActor(manual.battle)!
    const manualStep = manual.system.resolveActorTurn(manual.battle, manualActor, { kind: 'dynamic_basic', defId: 'orb_bo' })
    const autoStep = auto.system.resolveNextStep(auto.battle)

    expect(manualStep.skillId).toBe(autoStep.skillId)
    expect(manualStep.targetIds).toEqual(autoStep.targetIds)
  })
})
