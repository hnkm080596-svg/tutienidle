import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  TurnBattleSystem,
  type TurnBattle,
  type TurnBattleParticipant,
  type TurnDeclaredAction,
} from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { asBaseStats, createBaseStats } from '../../stats/StatBlock'
import { BuffPool } from '../../buff/BuffPool'
import { BuffSystem } from '../../buff/BuffSystem'
import { BUFF_REGISTRY } from '../../../data/buff/BuffRegistry'
import { PHAN_KICH } from '../../../data/skill/TheTuSkills'
import type { TurnSkillDefinition } from './TurnSkillAction'

// The Tu Reimagined (spec 6.2.1, plan Task 17) — the Ho intercept window:
// between an enemy-side declaration and impact, ONE player-side
// protector (nearest to the attacker, carrying the ho_mon marker, able
// to pay the proc cost) rolls protectChance; on success it replaces the
// declared target and the hit resolves fully vs the protector.

const NO_MITIGATION = {
  evasionRate: 0,
  dexterity: 0,
  criticalRate: 0,
  defense: 0,
  endurancePercent: 0,
  blockChance: 0,
  finalDamageReductionPercent: 0,
} as const

function createCombatant(overrides: Partial<CombatEntity> = {}, speed = 10): CombatEntity {
  const stats = createBaseStats({ ...NO_MITIGATION, might: 100, speed })

  const entity = {
    id: 'id',
    name: 'name',
    type: 'enemy',
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
    baseStats: overrides.baseStats ?? overrides.stats ?? stats,
  } as CombatEntity

  const ceiling = Math.max(entity.maxHp, entity.currentHp)
  if (entity.stats.maxHp !== ceiling) {
    entity.stats = { ...entity.stats, maxHp: ceiling }
    entity.baseStats = asBaseStats({ ...entity.baseStats, maxHp: ceiling })
  }
  return entity
}

const ENEMY_BASIC: TurnSkillDefinition = {
  id: 'enemy_hit',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 1 },
  targeting: { shape: 'single' },
}

function makeParticipant(id: string, entity: CombatEntity, speed: number, priority: number): TurnBattleParticipant {
  return { id, entity, speed, priority, actionGauge: 0, alive: entity.alive, buffs: new BuffPool(), consecutiveHardCcTurns: 0 }
}

/** A protector participant carrying a live ho_mon marker. */
function withHoMon(p: TurnBattleParticipant, protectChance: number, currentThe: number): TurnBattleParticipant {
  p.entity.baseStats = asBaseStats({ ...p.entity.baseStats, protectChance })
  p.entity.stats = { ...p.entity.stats, protectChance }
  p.entity.currentThe = currentThe
  new BuffSystem(p.buffs).apply(BUFF_REGISTRY.get('ho_mon'), p.entity, p.entity, BUFF_REGISTRY)
  return p
}

interface Fixture {
  battle: TurnBattle
  enemyP: TurnBattleParticipant
  squishyP: TurnBattleParticipant
  protectorP: TurnBattleParticipant
}

/** Enemy at (0,0); protected ally at (0,2); protector at (5,2) — near. */
function makeFixture(): Fixture {
  const enemy = createCombatant({ id: 'enemy', type: 'enemy', currentHp: 100_000, maxHp: 100_000, x: 0, row: 0 }, 10)
  const squishy = createCombatant({ id: 'squishy', type: 'player', currentHp: 100_000, maxHp: 100_000, x: 0, row: 2 }, 5)
  const protector = createCombatant({ id: 'protector', type: 'player', currentHp: 100_000, maxHp: 100_000, x: 5, row: 2 }, 5)

  const enemyP = makeParticipant('enemy', enemy, 10, 100)
  enemyP.basic = ENEMY_BASIC
  const squishyP = makeParticipant('squishy', squishy, 5, 0)
  const protectorP = makeParticipant('protector', protector, 5, 1)

  return {
    battle: { players: [squishyP, protectorP], enemies: [enemyP], state: 'fighting' },
    enemyP,
    squishyP,
    protectorP,
  }
}

/** A declared enemy action against the squishy — the pre-impact state. */
function declaredAgainst(fixture: Fixture, affected: TurnBattleParticipant[]): TurnDeclaredAction {
  return {
    actorId: 'enemy',
    skillId: ENEMY_BASIC.id,
    ccBlocked: false,
    isCharging: false,
    chargeResolved: false,
    chargeTargetIds: [],
    chargedSkill: null,
    action: {
      skillId: ENEMY_BASIC.id,
      skill: ENEMY_BASIC,
      damage: ENEMY_BASIC.damage,
      targeting: ENEMY_BASIC.targeting,
      slot: null,
    },
    opposingSide: fixture.battle.players,
    affected,
    scaledDamage: ENEMY_BASIC.damage ?? null,
    suddenDeathMultiplier: 1,
    compositePickedSkills: null,
    isFollowUpBypass: false,
    actionSource: 'normal',
  }
}

function system(): TurnBattleSystem {
  return new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000, BUFF_REGISTRY)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Ho intercept window (spec 6.2.1)', () => {
  it('a successful protectChance roll substitutes the protector as the hit target', () => {
    const f = makeFixture()
    withHoMon(f.protectorP, 1, 15)
    vi.spyOn(Math, 'random').mockReturnValue(0) // proc roll succeeds

    const declared = declaredAgainst(f, [f.squishyP])
    const { targetIds } = system().applyActionImpact(f.battle, declared)

    expect(declared.affected).toEqual([f.protectorP])
    expect(declared.intercepted).toBe(true)
    expect(declared.interceptedBy).toBe('protector')
    expect(targetIds).toEqual(['protector'])
    expect(f.protectorP.entity.currentHp).toBeLessThan(100_000)
    expect(f.squishyP.entity.currentHp).toBe(100_000)
    // Economy: -15 attempt, +20 success credit.
    expect(f.protectorP.entity.currentThe).toBe(20)
  })

  it('only the NEAREST protector rolls — a broke near-protector means no fallback to the far one', () => {
    const f = makeFixture()
    // Near protector at (5,2) cannot pay; far protector at (9,2) is rich
    // with guaranteed chance — spec D5: one substitution attempt only.
    withHoMon(f.protectorP, 1, 5)

    const far = createCombatant({ id: 'far', type: 'player', currentHp: 100_000, maxHp: 100_000, x: 9, row: 2 }, 5)
    const farP = withHoMon(makeParticipant('far', far, 5, 2), 1, 100)
    f.battle.players.push(farP)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const declared = declaredAgainst(f, [f.squishyP])
    system().applyActionImpact(f.battle, declared)

    expect(declared.intercepted).toBeUndefined()
    expect(f.squishyP.entity.currentHp).toBeLessThan(100_000)
    // The far protector's pool was never touched — no attempt, no gain.
    expect(farP.entity.currentThe).toBe(100)
  })

  it('insufficient The on the nearest protector -> no roll, no substitution', () => {
    const f = makeFixture()
    withHoMon(f.protectorP, 1, 14) // below the 15 cost
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const declared = declaredAgainst(f, [f.squishyP])
    system().applyActionImpact(f.battle, declared)

    expect(declared.intercepted).toBeUndefined()
    expect(f.squishyP.entity.currentHp).toBeLessThan(100_000)
    expect(f.protectorP.entity.currentThe).toBe(14)
  })

  it('a failed roll still pays the cost and does not substitute', () => {
    const f = makeFixture()
    withHoMon(f.protectorP, 0.5, 15)
    vi.spyOn(Math, 'random').mockReturnValue(0.99) // roll fails

    const declared = declaredAgainst(f, [f.squishyP])
    system().applyActionImpact(f.battle, declared)

    expect(declared.intercepted).toBeUndefined()
    expect(f.squishyP.entity.currentHp).toBeLessThan(100_000)
    expect(f.protectorP.entity.currentThe).toBe(0) // cost paid, no gain
  })

  it('multi-target (AoE) actions never open the window', () => {
    const f = makeFixture()
    withHoMon(f.protectorP, 1, 100)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const declared = declaredAgainst(f, [f.squishyP, f.protectorP])
    system().applyActionImpact(f.battle, declared)

    expect(declared.intercepted).toBeUndefined()
    expect(f.squishyP.entity.currentHp).toBeLessThan(100_000)
    expect(f.protectorP.entity.currentThe).toBe(100)
  })

  it('a dead protector is not a candidate', () => {
    const f = makeFixture()
    withHoMon(f.protectorP, 1, 100)
    f.protectorP.entity.alive = false
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const declared = declaredAgainst(f, [f.squishyP])
    system().applyActionImpact(f.battle, declared)

    expect(declared.intercepted).toBeUndefined()
    expect(f.squishyP.entity.currentHp).toBeLessThan(100_000)
  })

  it('the original target is excluded — a marker on the target alone cannot self-intercept', () => {
    const f = makeFixture()
    // The marker sits on the TARGET; protector has none.
    withHoMon(f.squishyP, 1, 100)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const declared = declaredAgainst(f, [f.squishyP])
    system().applyActionImpact(f.battle, declared)

    expect(declared.intercepted).toBeUndefined()
    expect(f.squishyP.entity.currentHp).toBeLessThan(100_000)
    expect(f.squishyP.entity.currentThe).toBe(100)
  })

  it('intercept -> dodge -> counter chain: composite context carries intercepted + evaded', () => {
    const f = makeFixture()
    // Protector intercepts, dodges, and its phan_mon onEvade proc queues
    // a counter whose composite context records the full chain.
    withHoMon(f.protectorP, 1, 100)
    f.protectorP.entity.baseStats = asBaseStats({
      ...f.protectorP.entity.baseStats,
      evasionRate: 1_000_000,
      counterChance: 1,
    })
    f.protectorP.entity.stats = { ...f.protectorP.entity.stats, evasionRate: 1_000_000, counterChance: 1 }
    new BuffSystem(f.protectorP.buffs).apply(BUFF_REGISTRY.get('phan_mon'), f.protectorP.entity, f.protectorP.entity, BUFF_REGISTRY)
    f.protectorP.reactivePayloads = { phan_kich: { ...PHAN_KICH } }

    // intercept roll 0 (success), dodge roll 0.999, counter roll 0.
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.999)
      .mockReturnValue(0)

    const declared = declaredAgainst(f, [f.squishyP])
    system().applyActionImpact(f.battle, declared)

    expect(declared.intercepted).toBe(true)
    expect(f.protectorP.entity.currentHp).toBe(100_000) // dodged
    expect(f.battle.queuedFollowUps).toHaveLength(1)
    expect(f.battle.queuedFollowUps![0]).toMatchObject({
      actorId: 'protector',
      actionSource: 'counter',
      payloadSkillId: 'phan_kich',
      targetIds: ['enemy'],
      triggerContext: { origin: 'enemy_hit', intercepted: true, outcome: 'evaded' },
    })
  })
})
