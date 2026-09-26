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
import { buffs as LIVE_BUFFS } from '../../../data/buff/buffs'
import { makeTestBuffRegistry, makeTurnRuntime, type TurnRuntimeFixture } from './testing/TurnRuntimeFixtures'
import { FunctionCombatRng } from '../runtime/rng/FunctionCombatRng'
import { PHAN_KICH, buildTheTuAnKit } from '../../../data/skill/TheTuSkills'
import { PHAN_CHAN_BUFF, PHAN_CHAN_BASE_RATIO } from '../../../data/buff/TheTuBuffs'
import { THE_PROC_COST, UNG_TRE_GAUGE_PENALTY, REACTION_DEBT_CAP } from '../../the-tu/TheEconomy'
import type { EntityVitalsChangedEvent } from '../../combat/EntityVitalsSystem'
import type { TurnSkillDefinition } from './TurnSkillAction'

// Ung The beta (design Parts V-VI + XI) — the Ho intercept window:
// between an enemy-side declaration and impact, ONE player-side
// protector (nearest to the attacker, carrying the ho_mon marker,
// OBSERVING the attacker, free of hard CC, not Qua The) rolls
// protectChance; on success ONLY it pays The + commits Ung Tre debt and
// replaces the declared target — the hit resolves fully vs the
// protector (Hộ can kill; the rescued ally is safe regardless).

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
  // - semantically multi-target regardless of how many entries survive
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
  return { id, entity, speed, priority, actionGauge: 0, alive: entity.alive, consecutiveHardCcTurns: 0 }
}

/** A protector participant carrying a live ho_mon marker + Tham focus. */
function withHoMon(
  f: Fixture,
  p: TurnBattleParticipant,
  protectChance: number,
  currentThe: number,
  opts: { observed?: boolean } = {},
): TurnBattleParticipant {
  p.entity.baseStats = asBaseStats({ ...p.entity.baseStats, protectChance })
  p.entity.stats = { ...p.entity.stats, protectChance }
  p.entity.currentThe = currentThe
  f.runtime.applyBuff('ho_mon', p)
  if (opts.observed !== false) {
    p.thamTargetId = 'enemy'
  }
  return p
}

interface Fixture {
  battle: TurnBattle
  enemyP: TurnBattleParticipant
  squishyP: TurnBattleParticipant
  protectorP: TurnBattleParticipant
  eventBus: EventBus
  combat: CombatSystem
  runtime: TurnRuntimeFixture
  /** Lazy roll source shared by the runtime's proc rng -- tests pin it
      to script proc outcomes exactly like the old injected seam. */
  roll: () => number
}

/** Enemy at (0,0); protected ally at (0,2); protector at (5,2) - near. */
function makeFixture(opts: { interceptWardRatio?: number } = {}): Fixture {
  const enemy = createCombatant({ id: 'enemy', type: 'enemy', currentHp: 100_000, maxHp: 100_000, x: 0, row: 0 }, 10)
  const squishy = createCombatant({ id: 'squishy', type: 'player', currentHp: 100_000, maxHp: 100_000, x: 0, row: 2 }, 5)
  const protector = createCombatant({ id: 'protector', type: 'player', currentHp: 100_000, maxHp: 100_000, x: 5, row: 2 }, 5)

  const enemyP = makeParticipant('enemy', enemy, 10, 100)
  enemyP.basic = ENEMY_BASIC
  const squishyP = makeParticipant('squishy', squishy, 5, 0)
  const protectorP = makeParticipant('protector', protector, 5, 1)

  const battle: TurnBattle = { players: [squishyP, protectorP], enemies: [enemyP], state: 'fighting' }
  const eventBus = new EventBus()
  const combat = new CombatSystem(eventBus)
  // When Ho Bich is owned, the kit-clone seam bakes
  // grantsWardToOriginalTarget onto the ho_mon marker clone -- the test
  // swaps in the same baked clone under its own id (registry defs never
  // mutate).
  const defs = LIVE_BUFFS.slice()
  if (opts.interceptWardRatio !== undefined) {
    const baked = buildTheTuAnKit(
      {
        observationGainBonus: 0,
        phanKinhArmorPierce: 0,
        interceptWardRatio: opts.interceptWardRatio,
        evadeCounterMultiplierBonus: 0,
        danTheBonus: 0,
      },
      { quanThe: true, quanTheCoreLevel: 1 },
    )
    const hoMonClone = baked.basic.grantsBuffsAtBuild!.find((def) => def.id === 'ho_mon')!
    const index = defs.findIndex((def) => def.id === 'ho_mon')
    defs[index] = hoMonClone
  }
  const registry = makeTestBuffRegistry(defs)
  const f: Fixture = {
    battle,
    enemyP,
    squishyP,
    protectorP,
    eventBus,
    combat,
    roll: () => Math.random(),
    runtime: undefined as unknown as TurnRuntimeFixture,
  }
  f.runtime = makeTurnRuntime({
    registry,
    participants: () => [...battle.players, ...battle.enemies],
    combatSystem: combat,
    rng: new FunctionCombatRng(() => f.roll()),
  })
  return f
}

/** A declared enemy action against the squishy - the pre-impact state. */
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

function system(f: Fixture, rng?: () => number): TurnBattleSystem {
  // The rng seam is the LAST constructor param - engine rolls draw from
  // it; proc rolls draw from the runtime's rng, which reads f.roll, so
  // a scripted closure here must feed BOTH seams (same stream, same
  // consumption order as the old single-seam construction).
  if (rng !== undefined) {
    f.roll = rng
  }
  return new TurnBattleSystem(
    f.combat,
    10_000,
    f.runtime.registry,
    /*spawnEnemy*/ undefined,
    f.runtime,
    /*onSkillCast*/ undefined,
    /*liveStatModifiers*/ undefined,
    rng === undefined ? undefined : new FunctionCombatRng(rng),
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Ho intercept window (Ung The beta)', () => {
  it('a successful protectChance roll substitutes the protector — pays on success only, +1 debt', () => {
    const f = makeFixture()
    withHoMon(f, f.protectorP, 1, THE_PROC_COST)
    f.protectorP.actionGauge = 500
    vi.spyOn(Math, 'random').mockReturnValue(0) // proc roll succeeds

    const declared = declaredAgainst(f, [f.squishyP])
    const { targetIds } = system(f).applyActionImpact(f.battle, declared)

    expect(declared.affected).toEqual([f.protectorP])
    expect(declared.intercepted).toBe(true)
    expect(declared.interceptedBy).toBe('protector')
    expect(targetIds).toEqual(['protector'])
    expect(f.protectorP.entity.currentHp).toBeLessThan(100_000)
    expect(f.squishyP.entity.currentHp).toBe(100_000)
    // Success-only payment: -15, no income credit; +1 Ung Tre debt and
    // the authored gauge penalty on the NEXT natural action.
    expect(f.protectorP.entity.currentThe).toBe(0)
    expect(f.protectorP.reactionDebt).toBe(1)
    expect(f.protectorP.actionGauge).toBe(500 - UNG_TRE_GAUGE_PENALTY)
  })

  it('an UNOBSERVED attacker opens no window — mark or Quan The required', () => {
    const f = makeFixture()
    withHoMon(f, f.protectorP, 1, 100, { observed: false })
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const declared = declaredAgainst(f, [f.squishyP])
    system(f).applyActionImpact(f.battle, declared)

    expect(declared.intercepted).toBeUndefined()
    expect(f.squishyP.entity.currentHp).toBeLessThan(100_000)
    expect(f.protectorP.entity.currentThe).toBe(100)
  })

  it('Quan The active: an unmarked attacker still satisfies observation', () => {
    const f = makeFixture()
    withHoMon(f, f.protectorP, 1, 100, { observed: false })
    f.runtime.applyBuff('quan_the', f.protectorP)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const declared = declaredAgainst(f, [f.squishyP])
    system(f).applyActionImpact(f.battle, declared)

    expect(declared.intercepted).toBe(true)
    expect(f.squishyP.entity.currentHp).toBe(100_000)
  })

  it('Qua The (debt at cap) closes the window — no roll, no payment', () => {
    const f = makeFixture()
    withHoMon(f, f.protectorP, 1, 100)
    f.protectorP.reactionDebt = REACTION_DEBT_CAP
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const declared = declaredAgainst(f, [f.squishyP])
    system(f).applyActionImpact(f.battle, declared)

    expect(declared.intercepted).toBeUndefined()
    expect(f.squishyP.entity.currentHp).toBeLessThan(100_000)
    expect(f.protectorP.entity.currentThe).toBe(100)
    expect(f.protectorP.reactionDebt).toBe(REACTION_DEBT_CAP)
  })

  it('hard CC (stun) closes the window — no roll, no payment', () => {
    const f = makeFixture()
    withHoMon(f, f.protectorP, 1, 100)
    f.runtime.applyBuff('choang', f.protectorP)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const declared = declaredAgainst(f, [f.squishyP])
    system(f).applyActionImpact(f.battle, declared)

    expect(declared.intercepted).toBeUndefined()
    expect(f.squishyP.entity.currentHp).toBeLessThan(100_000)
    expect(f.protectorP.entity.currentThe).toBe(100)
  })

  it('an invalid window consumes NO proc RNG — the gate sits before the roll lane', () => {
    const f = makeFixture()
    // Unaffordable + unobserved: both ride caller-side gates, so
    // resolveReactiveProcs never runs — observable contract: no payment,
    // no substitution, no queue.
    withHoMon(f, f.protectorP, 1, 5, { observed: false })
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const declared = declaredAgainst(f, [f.squishyP])
    system(f).applyActionImpact(f.battle, declared)

    expect(declared.intercepted).toBeUndefined()
    expect(f.protectorP.entity.currentThe).toBe(5)
    expect(f.battle.queuedFollowUps ?? []).toHaveLength(0)
  })

  it('only the NEAREST protector rolls — a broke near-protector means no fallback to the far one', () => {
    const f = makeFixture()
    // Near protector at (5,2) cannot pay; far protector at (9,2) is rich
    // with guaranteed chance - spec D5: one substitution attempt only.
    withHoMon(f, f.protectorP, 1, 5)

    const far = createCombatant({ id: 'far', type: 'player', currentHp: 100_000, maxHp: 100_000, x: 9, row: 2 }, 5)
    const farP = withHoMon(f, makeParticipant('far', far, 5, 2), 1, 100)
    f.battle.players.push(farP)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const declared = declaredAgainst(f, [f.squishyP])
    system(f).applyActionImpact(f.battle, declared)

    expect(declared.intercepted).toBeUndefined()
    expect(f.squishyP.entity.currentHp).toBeLessThan(100_000)
    // The far protector's pool was never touched — no attempt at all.
    expect(farP.entity.currentThe).toBe(100)
  })

  it('insufficient The on the nearest protector -> no roll, no payment, no substitution', () => {
    const f = makeFixture()
    withHoMon(f, f.protectorP, 1, THE_PROC_COST - 1)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const declared = declaredAgainst(f, [f.squishyP])
    system(f).applyActionImpact(f.battle, declared)

    expect(declared.intercepted).toBeUndefined()
    expect(f.squishyP.entity.currentHp).toBeLessThan(100_000)
    expect(f.protectorP.entity.currentThe).toBe(THE_PROC_COST - 1)
  })

  it('a FAILED roll pays nothing and does not substitute — success-only cost', () => {
    const f = makeFixture()
    withHoMon(f, f.protectorP, 0.5, THE_PROC_COST)
    vi.spyOn(Math, 'random').mockReturnValue(0.99) // roll fails

    const declared = declaredAgainst(f, [f.squishyP])
    system(f).applyActionImpact(f.battle, declared)

    expect(declared.intercepted).toBeUndefined()
    expect(f.squishyP.entity.currentHp).toBeLessThan(100_000)
    expect(f.protectorP.entity.currentThe).toBe(THE_PROC_COST) // untouched
    expect(f.protectorP.reactionDebt ?? 0).toBe(0)
  })

  it('multi-target (AoE) actions never open the window', () => {
    const f = makeFixture()
    withHoMon(f, f.protectorP, 1, 100)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const declared = declaredAgainst(f, [f.squishyP, f.protectorP])
    system(f).applyActionImpact(f.battle, declared)

    expect(declared.intercepted).toBeUndefined()
    expect(f.squishyP.entity.currentHp).toBeLessThan(100_000)
    expect(f.protectorP.entity.currentThe).toBe(100)
  })

  it('a dead protector is not a candidate', () => {
    const f = makeFixture()
    withHoMon(f, f.protectorP, 1, 100)
    f.protectorP.entity.alive = false
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const declared = declaredAgainst(f, [f.squishyP])
    system(f).applyActionImpact(f.battle, declared)

    expect(declared.intercepted).toBeUndefined()
    expect(f.squishyP.entity.currentHp).toBeLessThan(100_000)
  })

  it('the original target is excluded — a marker on the target alone cannot self-intercept', () => {
    const f = makeFixture()
    // The marker sits on the TARGET; protector has none.
    withHoMon(f, f.squishyP, 1, 100)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const declared = declaredAgainst(f, [f.squishyP])
    system(f).applyActionImpact(f.battle, declared)

    expect(declared.intercepted).toBeUndefined()
    expect(f.squishyP.entity.currentHp).toBeLessThan(100_000)
    expect(f.squishyP.entity.currentThe).toBe(100)
  })

  it('a LETHAL intercepted hit kills the protector — the rescued ally is safe regardless', () => {
    const f = makeFixture()
    withHoMon(f, f.protectorP, 1, 100)
    f.protectorP.entity.currentHp = 10 // x1 hit (might 100) exceeds it
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const declared = declaredAgainst(f, [f.squishyP])
    system(f).applyActionImpact(f.battle, declared)

    expect(declared.intercepted).toBe(true)
    expect(f.protectorP.entity.alive).toBe(false)
    expect(f.squishyP.entity.currentHp).toBe(100_000)
    // Commit already happened — debt stands, no rollback on death.
    expect(f.protectorP.reactionDebt).toBe(1)
  })

  it('Ho Bich: a committed Ho grants the rescued ally a ho_ve ward scaled on protector Max HP — it survives protector death', () => {
    const f = makeFixture({ interceptWardRatio: 0.15 })
    withHoMon(f, f.protectorP, 1, 100)
    f.protectorP.entity.currentHp = 10 // the intercept is lethal
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const declared = declaredAgainst(f, [f.squishyP])
    system(f).applyActionImpact(f.battle, declared)

    expect(declared.intercepted).toBe(true)
    expect(f.protectorP.entity.alive).toBe(false)
    expect(f.squishyP.entity.currentHp).toBe(100_000)

    const hoVe = f.runtime.buffs.getForTarget('squishy').find((inst) => inst.definitionId === 'ho_ve')
    expect(hoVe).toBeDefined()
    expect(hoVe!.sourceId).toBe('protector')
    expect(f.squishyP.entity.externalWard).toEqual({ sourceId: 'protector', amount: 100_000 * 0.15 })
  })

  it('intercept -> dodge -> counter chain: composite context carries intercepted + evaded', () => {
    const f = makeFixture()
    // Protector intercepts, dodges, and its phan_mon onEvade proc queues
    // a counter whose composite context records the full chain.
    withHoMon(f, f.protectorP, 1, 100)
    f.protectorP.entity.baseStats = asBaseStats({
      ...f.protectorP.entity.baseStats,
      evasionRate: 1_000_000,
      counterChance: 1,
    })
    f.protectorP.entity.stats = { ...f.protectorP.entity.stats, evasionRate: 1_000_000, counterChance: 1 }
    f.runtime.applyBuff('phan_mon', f.protectorP)
    f.protectorP.reactivePayloads = { phan_kich: { ...PHAN_KICH } }

    // intercept roll 0 (success), dodge roll 0.999, counter roll 0.
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.999)
      .mockReturnValue(0)

    const declared = declaredAgainst(f, [f.squishyP])
    system(f).applyActionImpact(f.battle, declared)

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
    // Two commits (Ho + Phan) — debt 2, pool -30.
    expect(f.protectorP.reactionDebt).toBe(2)
    expect(f.protectorP.entity.currentThe).toBe(70)
  })
})

describe('Ho intercept — semantic single-target', () => {
  it('an all_lanes cast whose affected shrank to one entry does NOT open the window', () => {
    const f = makeFixture()
    f.enemyP.basic = ENEMY_AOE
    withHoMon(f, f.protectorP, 1, 100)
    // Injected rng pinned low - the proc roll WOULD succeed if the
    // window opened. The hit on the squishy lands by construction
    // (accuracy 100 vs evasion 0 -> hit chance 1.0), so the global
    // Math.random needs no spy.

    // The AoE anchors on the squishy (column 0); the protector sits at
    // column 5 outside the columnRadius-1 band, so the declare collects
    // a single affected entry - the degenerate case an affected-count
    // gate misreads as a single-target hit.
    const sys = system(f, () => 0)
    const declared = sys.declareActorAction(f.battle, f.enemyP)

    expect(declared.affected).toEqual([f.squishyP])

    const { targetIds } = sys.applyActionImpact(f.battle, declared)

    expect(declared.intercepted).toBeUndefined()
    expect(declared.affected).toEqual([f.squishyP])
    expect(targetIds).toEqual(['squishy'])
    expect(f.squishyP.entity.currentHp).toBeLessThan(100_000)
    expect(f.protectorP.entity.currentHp).toBe(100_000)
    expect(f.protectorP.entity.currentThe).toBe(100) // no payment
  })

  it('a charge-resolved single-target hit DOES open the window — the protector eats it', () => {
    const f = makeFixture()
    f.enemyP.special = { skill: ENEMY_CHARGED, remainingCooldownTurns: 0 }
    withHoMon(f, f.protectorP, 1, 100)

    // Injected rng pinned low - the intercept proc roll succeeds. The
    // substituted hit lands on the protector by construction (hit
    // chance 1.0), so the global Math.random needs no spy.
    const sys = system(f, () => 0)

    // Charge-init turn: the cast commits here; no targets resolve yet.
    const init = sys.declareActorAction(f.battle, f.enemyP)
    sys.applyActionImpact(f.battle, init)
    expect(f.enemyP.chargingTurnsRemaining).toBe(1)

    // Charge-resolve turn: the declared targets materialize into BOTH
    // chargeTargetIds and affected - the intercept window and the
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
    // Substitution must rewrite the charged target set - that is the
    // array the charge-resolve hit loop iterates.
    expect(declared.chargeTargetIds).toEqual(['protector'])
    expect(targetIds).toEqual(['protector'])
    expect(f.protectorP.entity.currentHp).toBeLessThan(100_000)
    expect(f.squishyP.entity.currentHp).toBe(100_000)
  })

  it('a reactive enemy action (actionSource: counter) never opens the window (INV-9)', () => {
    const f = makeFixture()
    withHoMon(f, f.protectorP, 1, 100)
    // Injected rng pinned low - the roll would succeed if the window
    // opened; INV-9 must keep it closed.

    // A queued enemy-side reactive entry declares through the same
    // TurnDeclaredAction shape but carries a reactive actionSource -
    // INV-9 bars it from opening new reactive windows.
    const declared: TurnDeclaredAction = {
      ...declaredAgainst(f, [f.squishyP]),
      isFollowUpBypass: true,
      actionSource: 'counter',
    }

    const { targetIds } = system(f, () => 0).applyActionImpact(f.battle, declared)

    expect(declared.intercepted).toBeUndefined()
    expect(declared.affected).toEqual([f.squishyP])
    expect(targetIds).toEqual(['squishy'])
    expect(f.squishyP.entity.currentHp).toBeLessThan(100_000)
    expect(f.protectorP.entity.currentHp).toBe(100_000)
    expect(f.protectorP.entity.currentThe).toBe(100) // no payment
  })
})

// Regression guard - the charge-resolve lane once resolved hits through
// bare CombatSystem.resolveActionHit inside applyActionImpact, skipping
// the shared resolveDeclaredHit() pipeline: no defender onImpactLanded
// reactive window (Phan counter), no phan_chinh Reflection, and no
// appliesAilments application.
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
    withHoMon(f, f.protectorP, 1, 100)

    // phan_mon on the same protector - a taken hit rolls its
    // onImpactLanded counter.
    f.protectorP.entity.baseStats = asBaseStats({ ...f.protectorP.entity.baseStats, counterChance: 1 })
    f.protectorP.entity.stats = { ...f.protectorP.entity.stats, counterChance: 1 }
    f.runtime.applyBuff('phan_mon', f.protectorP)
    f.protectorP.reactivePayloads = { phan_kich: { ...PHAN_KICH } }

    // Injected rng pinned low: BOTH reactive-proc rolls (the intercept
    // and the taken-side counter) draw from the rng seam and succeed.
    // The hit lands by construction - no Math.random spy.
    const sys = system(f, () => 0)
    const declared = driveChargedHit(f, sys)
    const { targetIds } = sys.applyActionImpact(f.battle, declared)

    expect(declared.intercepted).toBe(true)
    expect(targetIds).toEqual(['protector'])
    expect(f.protectorP.entity.currentHp).toBeLessThan(100_000)

    const counters = (f.battle.queuedFollowUps ?? []).filter(
      (entry) => entry.actorId === 'protector' && entry.actionSource === 'counter',
    )

    expect(counters).toHaveLength(1)
    expect(counters[0]).toMatchObject({
      payloadSkillId: 'phan_kich',
      targetIds: ['enemy'],
      triggerContext: { origin: 'enemy_hit', intercepted: true, outcome: 'taken' },
    })
  })

  it('a charged hit into a phan_chan passive reflects back at the attacker', () => {
    const f = makeFixture()
    f.enemyP.special = { skill: ENEMY_CHARGED, remainingCooldownTurns: 0 }
    f.runtime.applyBuff(PHAN_CHAN_BUFF.id, f.squishyP)

    const sys = new TurnBattleSystem(f.combat, 10_000, f.runtime.registry, undefined, f.runtime)

    const reflections: number[] = []
    f.eventBus.on<EntityVitalsChangedEvent>('entity_vitals_changed', (event) => {
      if (event.reason === 'reflection' && event.entityId === 'enemy') {
        reflections.push(event.amount)
      }
    })

    const declared = driveChargedHit(f, sys)
    const { targetIds } = sys.applyActionImpact(f.battle, declared)

    expect(targetIds).toEqual(['squishy'])

    // might 100 x multiplier 1 = 100 hpDamage taken; the beta reflect
    // owes holder maxHp x ratio (Max-HP-derived, once per action).
    const expected = 100_000 * PHAN_CHAN_BASE_RATIO
    expect(reflections).toEqual([expected])
    expect(f.enemyP.entity.currentHp).toBe(100_000 - expected)
  })

  it('an intercepted hit reflects off the intercepting protector (phan_chan keyed on the protector)', () => {
    const f = makeFixture()
    // Protector intercepts (protectChance 1, roll pinned low) AND holds
    // phan_chan - the reflect must queue on the protector, not the
    // declared target, and land once on the attacker.
    withHoMon(f, f.protectorP, 1, 100)
    f.runtime.applyBuff(PHAN_CHAN_BUFF.id, f.protectorP)

    const reflections: number[] = []
    f.eventBus.on<EntityVitalsChangedEvent>('entity_vitals_changed', (event) => {
      if (event.reason === 'reflection' && event.entityId === 'enemy') {
        reflections.push(event.amount)
      }
    })

    const sys = system(f, () => 0)
    const declared = declaredAgainst(f, [f.squishyP])
    const { targetIds } = sys.applyActionImpact(f.battle, declared)

    expect(declared.intercepted).toBe(true)
    expect(targetIds).toEqual(['protector'])
    expect(f.protectorP.entity.currentHp).toBeLessThan(100_000)
    expect(f.squishyP.entity.currentHp).toBe(100_000)

    const expected = 100_000 * PHAN_CHAN_BASE_RATIO
    expect(reflections).toEqual([expected])
    expect(f.enemyP.entity.currentHp).toBe(100_000 - expected)
  })

  it('a charged skill carrying an ailment applies it on the landed hit', () => {
    const f = makeFixture()
    const chargedWithAilment: TurnSkillDefinition = {
      ...ENEMY_CHARGED,
      id: 'enemy_charged_burn',
      appliesAilments: [{ buffDefinitionId: 'hoa_an', chance: 1 }],
    }
    f.enemyP.special = { skill: chargedWithAilment, remainingCooldownTurns: 0 }

    // Injected rng pinned low: the chance-1 ailment roll draws from the
    // rng seam (applySkillAilments); the hit lands by construction.
    const sys = system(f, () => 0)
    const declared = driveChargedHit(f, sys)
    const { targetIds } = sys.applyActionImpact(f.battle, declared)

    expect(targetIds).toEqual(['squishy'])
    expect(
      f.runtime.buffs.getForTarget('squishy').filter((i) => i.definitionId === 'hoa_an'),
    ).toHaveLength(1)
  })
})

// RNG authority guard - the reactive-proc success roll in
// resolveReactiveProcs must draw from the injected this.rng, never the
// global Math.random. The pair below pins the two sources to OPPOSITE
// outcomes; the injected seam must win both directions. The hit roll
// still lands either way - accuracy 100 vs evasion 0 gives hit chance
// exactly 1.0.
describe('reactive proc rolls read the injected rng, not Math.random', () => {
  it('a protectChance-1.0 interceptor does NOT intercept when injected rng fails the roll (global pinned low)', () => {
    const f = makeFixture()
    withHoMon(f, f.protectorP, 1, THE_PROC_COST)
    // Global pinned to a would-succeed value - the proc seam ignores it.
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const declared = declaredAgainst(f, [f.squishyP])
    system(f, () => 0.999).applyActionImpact(f.battle, declared)

    expect(declared.intercepted).toBeUndefined()
    expect(declared.affected).toEqual([f.squishyP])
    // Failed roll pays NOTHING (success-only cost).
    expect(f.protectorP.entity.currentThe).toBe(THE_PROC_COST)
    expect(f.squishyP.entity.currentHp).toBeLessThan(100_000)
    expect(f.protectorP.entity.currentHp).toBe(100_000)
  })

  it('the interceptor DOES intercept when injected rng succeeds (global pinned high)', () => {
    const f = makeFixture()
    withHoMon(f, f.protectorP, 1, THE_PROC_COST)
    // Global pinned high - the injected rng low must still drive the
    // intercept. The global now only feeds the CombatSystem hit seam.
    vi.spyOn(Math, 'random').mockReturnValue(0.999)

    const declared = declaredAgainst(f, [f.squishyP])
    system(f, () => 0).applyActionImpact(f.battle, declared)

    expect(declared.intercepted).toBe(true)
    expect(declared.interceptedBy).toBe('protector')
    expect(f.squishyP.entity.currentHp).toBe(100_000)
    expect(f.protectorP.entity.currentHp).toBeLessThan(100_000)
    // Success paid the flat cost.
    expect(f.protectorP.entity.currentThe).toBe(0)
  })
})
