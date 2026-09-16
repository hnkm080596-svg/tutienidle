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
import { PHAN_CHINH_BUFF, PHAN_CHINH_MAXHP_RATIO, PHAN_CHINH_TAKEN_RATIO } from '../../../data/buff/TheTuBuffs'
import type { EntityVitalsChangedEvent } from '../../combat/EntityVitalsSystem'
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

const ENEMY_AOE: TurnSkillDefinition = {
  id: 'enemy_aoe',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 1 },
  // A column band across every lane (all_lanes, default columnRadius 1)
  // — semantically multi-target regardless of how many entries survive
  // in declared.affected at impact time.
  targeting: { shape: 'all_lanes' },
}

const ENEMY_CHARGED: TurnSkillDefinition = {
  id: 'enemy_charged',
  cooldownTurns: 0,
  chargeTurns: 1,
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

describe('Ho intercept — semantic single-target', () => {
  it('an all_lanes cast whose affected shrank to one entry does NOT open the window', () => {
    const f = makeFixture()
    f.enemyP.basic = ENEMY_AOE
    withHoMon(f.protectorP, 1, 100)
    vi.spyOn(Math, 'random').mockReturnValue(0) // the roll would succeed if the window opened

    // The AoE anchors on the squishy (column 0); the protector sits at
    // column 5 outside the columnRadius-1 band, so the declare collects
    // a single affected entry — the degenerate case an affected-count
    // gate misreads as a single-target hit.
    const sys = system()
    const declared = sys.declareActorAction(f.battle, f.enemyP)

    expect(declared.affected).toEqual([f.squishyP])

    const { targetIds } = sys.applyActionImpact(f.battle, declared)

    expect(declared.intercepted).toBeUndefined()
    expect(declared.affected).toEqual([f.squishyP])
    expect(targetIds).toEqual(['squishy'])
    expect(f.squishyP.entity.currentHp).toBeLessThan(100_000)
    expect(f.protectorP.entity.currentHp).toBe(100_000)
    expect(f.protectorP.entity.currentThe).toBe(100) // no attempt cost paid
  })

  it('a charge-resolved single-target hit DOES open the window — the protector eats it', () => {
    const f = makeFixture()
    f.enemyP.special = { skill: ENEMY_CHARGED, remainingCooldownTurns: 0 }
    withHoMon(f.protectorP, 1, 100)
    vi.spyOn(Math, 'random').mockReturnValue(0) // proc roll succeeds

    const sys = system()

    // Charge-init turn: the cast commits here; no targets resolve yet.
    const init = sys.declareActorAction(f.battle, f.enemyP)
    sys.applyActionImpact(f.battle, init)
    expect(f.enemyP.chargingTurnsRemaining).toBe(1)

    // Charge-resolve turn: the declared targets materialize into BOTH
    // chargeTargetIds and affected — the intercept window and the
    // charged hit lane share one consumed target list (the regression
    // this guards: affected used to stay EMPTY here, so the window
    // could never see a charged hit).
    const declared = sys.declareActorAction(f.battle, f.enemyP)

    expect(declared.chargeResolved).toBe(true)
    expect(declared.chargeTargetIds).toEqual(['squishy'])
    expect(declared.affected).toEqual([f.squishyP])

    const { targetIds } = sys.applyActionImpact(f.battle, declared)

    expect(declared.intercepted).toBe(true)
    expect(declared.interceptedBy).toBe('protector')
    expect(declared.affected).toEqual([f.protectorP])
    // Substitution must rewrite the charged target set — that is the
    // array the charge-resolve hit loop iterates.
    expect(declared.chargeTargetIds).toEqual(['protector'])
    expect(targetIds).toEqual(['protector'])
    expect(f.protectorP.entity.currentHp).toBeLessThan(100_000)
    expect(f.squishyP.entity.currentHp).toBe(100_000)
  })

  it('a reactive enemy action (actionSource: counter) never opens the window (INV-9)', () => {
    const f = makeFixture()
    withHoMon(f.protectorP, 1, 100)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    // A queued enemy-side reactive entry declares through the same
    // TurnDeclaredAction shape but carries a reactive actionSource —
    // INV-9 bars it from opening new reactive windows. The evade /
    // ally-action / taken windows all gate on this field; the intercept
    // window must too.
    const declared: TurnDeclaredAction = {
      ...declaredAgainst(f, [f.squishyP]),
      isFollowUpBypass: true,
      actionSource: 'counter',
    }

    const { targetIds } = system().applyActionImpact(f.battle, declared)

    expect(declared.intercepted).toBeUndefined()
    expect(declared.affected).toEqual([f.squishyP])
    expect(targetIds).toEqual(['squishy'])
    expect(f.squishyP.entity.currentHp).toBeLessThan(100_000)
    expect(f.protectorP.entity.currentHp).toBe(100_000)
    expect(f.protectorP.entity.currentThe).toBe(100) // no attempt cost paid
  })
})

// Regression guard - the charge-resolve lane once resolved hits through
// bare CombatSystem.resolveActionHit inside applyActionImpact, skipping
// the shared resolveDeclaredHit() pipeline: no defender onImpactLanded
// reactive window (Phan counter), no phan_chinh Reflection, and no
// appliesAilments application. Evaded charged hits DID work (the lane
// called resolveEvadeWindow itself) - the defect was taken-side only.
describe('charged hits run the declared-hit pipeline (resolveDeclaredHit)', () => {
  /** Drives a charge-init + charge-resolve declare/apply pair; returns the resolve-turn declaration. */
  function driveChargedHit(f: Fixture, sys: TurnBattleSystem): TurnDeclaredAction {
    const init = sys.declareActorAction(f.battle, f.enemyP)
    sys.applyActionImpact(f.battle, init)
    expect(f.enemyP.chargingTurnsRemaining).toBe(1)

    const declared = sys.declareActorAction(f.battle, f.enemyP)
    expect(declared.chargeResolved).toBe(true)
    return declared
  }

  it('charged + intercepted + TAKEN hit opens the protector onImpactLanded Phan window', () => {
    const f = makeFixture()
    f.enemyP.special = { skill: ENEMY_CHARGED, remainingCooldownTurns: 0 }
    withHoMon(f.protectorP, 1, 100)

    // phan_mon on the same protector - a taken hit rolls its
    // onImpactLanded counter (counterChance hard-caps at
    // REACTIVE_CHANCE_CAP = 0.6, so the pinned-0 roll succeeds).
    f.protectorP.entity.baseStats = asBaseStats({ ...f.protectorP.entity.baseStats, counterChance: 1 })
    f.protectorP.entity.stats = { ...f.protectorP.entity.stats, counterChance: 1 }
    new BuffSystem(f.protectorP.buffs).apply(BUFF_REGISTRY.get('phan_mon'), f.protectorP.entity, f.protectorP.entity, BUFF_REGISTRY)
    f.protectorP.reactivePayloads = { phan_kich: { ...PHAN_KICH } }

    vi.spyOn(Math, 'random').mockReturnValue(0)

    const sys = system()
    const declared = driveChargedHit(f, sys)
    const { targetIds } = sys.applyActionImpact(f.battle, declared)

    expect(declared.intercepted).toBe(true)
    expect(targetIds).toEqual(['protector'])
    // TAKEN, not dodged - hpDamage > 0 is the window's gate.
    expect(f.protectorP.entity.currentHp).toBeLessThan(100_000)

    const counters = (f.battle.queuedFollowUps ?? []).filter(
      (entry) => entry.actorId === 'protector' && entry.actionSource === 'counter',
    )

    // Pre-fix failure signature: no entry - the charged lane never
    // reached resolveReactiveProcs.
    expect(counters).toHaveLength(1)
    expect(counters[0]).toMatchObject({
      payloadSkillId: 'phan_kich',
      targetIds: ['enemy'],
      triggerContext: { origin: 'enemy_hit', intercepted: true, outcome: 'taken' },
    })
  })

  it('a charged hit into a phan_chinh emblem reflects back at the attacker', () => {
    const f = makeFixture()
    f.enemyP.special = { skill: ENEMY_CHARGED, remainingCooldownTurns: 0 }
    new BuffSystem(f.squishyP.buffs).apply(PHAN_CHINH_BUFF, f.squishyP.entity, f.squishyP.entity, BUFF_REGISTRY)

    const eventBus = new EventBus()
    const sys = new TurnBattleSystem(new CombatSystem(eventBus), 10_000, BUFF_REGISTRY)

    const reflections: number[] = []
    eventBus.on<EntityVitalsChangedEvent>('entity_vitals_changed', (event) => {
      if (event.reason === 'reflection' && event.entityId === 'enemy') {
        reflections.push(event.amount)
      }
    })

    // Rolls pinned low: the hit lands (evasion 0); reflect chance is
    // authored 1.0.
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const declared = driveChargedHit(f, sys)
    const { targetIds } = sys.applyActionImpact(f.battle, declared)

    expect(targetIds).toEqual(['squishy'])

    // might 100 x multiplier 1 = 100 hpDamage taken; the emblem owes
    // hpDamage x takenRatio + holder maxHp x maxHpRatio.
    const expected = 100 * PHAN_CHINH_TAKEN_RATIO + 100_000 * PHAN_CHINH_MAXHP_RATIO
    expect(reflections).toEqual([expected])
    expect(f.enemyP.entity.currentHp).toBe(100_000 - expected)
  })

  it('a charged skill carrying an ailment applies it on the landed hit', () => {
    const f = makeFixture()
    const chargedWithAilment: TurnSkillDefinition = {
      ...ENEMY_CHARGED,
      id: 'enemy_charged_burn',
      appliesAilments: [{ buffDefinitionId: 'bong', chance: 1 }],
    }
    f.enemyP.special = { skill: chargedWithAilment, remainingCooldownTurns: 0 }

    // Rolls pinned low: the hit lands; the chance-1 ailment applies.
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const sys = system()
    const declared = driveChargedHit(f, sys)
    const { targetIds } = sys.applyActionImpact(f.battle, declared)

    expect(targetIds).toEqual(['squishy'])
    expect(f.squishyP.buffs.getAllById('bong')).toHaveLength(1)
  })
})
