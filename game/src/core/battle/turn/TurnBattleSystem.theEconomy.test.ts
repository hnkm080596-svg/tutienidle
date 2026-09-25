import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  TurnBattleSystem,
  type TurnBattle,
  type TurnBattleParticipant,
} from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { asBaseStats, createBaseStats } from '../../stats/StatBlock'
import { BUFF_REGISTRY } from '../../../data/buff/BuffRegistry'
import { THAM_THE } from '../../../data/skill/TheTuSkills'
import {
  DAN_THE_INCOME_MULT,
  REACTION_DEBT_CAP,
  THE_PROC_COST,
  UNG_TRE_GAUGE_PENALTY,
  grantThe,
  theCap,
  theGainOnBasicHit,
  theGainOnObservedAction,
} from '../../the-tu/TheEconomy'
import { MAX_THE } from '../../combat/CombatTypes'
import { makeTurnRuntime, type TurnRuntimeFixture } from './testing/TurnRuntimeFixtures'

// Ung The beta (design authority Parts II-VII) — the observation-driven
// The economy: income ONLY from Tham The landed + an observed enemy
// completing a normal action, landing AFTER that action's own reactive
// windows close (INV-10). No passive income, no free procs: the flat
// authored cost pays on success only, and every committed reaction
// commits +1 Ung Tre debt (gauge penalty on the next natural action).

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

function makeParticipant(id: string, entity: CombatEntity, speed: number, priority: number): TurnBattleParticipant {
  return { id, entity, speed, priority, actionGauge: 0, alive: entity.alive, consecutiveHardCcTurns: 0 }
}

const ENEMY_HIT = {
  id: 'enemy_hit',
  cooldownTurns: 0,
  damage: { kind: 'physical' as const, multiplier: 1 },
  targeting: { shape: 'single' as const },
}

function makeWorld(participants: TurnBattleParticipant[]) {
  const combat = new CombatSystem(new EventBus())
  const runtime = makeTurnRuntime({
    registry: BUFF_REGISTRY,
    participants: () => participants,
    combatSystem: combat,
  })

  return { combat, runtime }
}

function makeBattle(enemyCount = 1): {
  battle: TurnBattle
  playerP: TurnBattleParticipant
  enemyP: TurnBattleParticipant
  enemyP2: TurnBattleParticipant | undefined
  participants: TurnBattleParticipant[]
  combat: CombatSystem
  runtime: TurnRuntimeFixture
} {
  // High maxHp on both sides — a x1 basic must never one-shot (the enemy
  // has to survive to take its turn).
  const player = createCombatant({ id: 'ung', type: 'player', currentHp: 100_000, maxHp: 100_000 }, 10)
  const enemy = createCombatant({ id: 'enemy', currentHp: 100_000, maxHp: 100_000 }, 9)
  const enemy2 = enemyCount > 1
    ? createCombatant({ id: 'enemy2', currentHp: 100_000, maxHp: 100_000 }, 8)
    : undefined

  const playerP = makeParticipant('ung', player, 10, 0)
  playerP.basic = { ...THAM_THE }
  const enemyP = makeParticipant('enemy', enemy, 9, 100)
  enemyP.basic = { ...ENEMY_HIT }
  const enemyP2 = enemy2 === undefined
    ? undefined
    : { ...makeParticipant('enemy2', enemy2, 8, 101), basic: { ...ENEMY_HIT } }

  const enemies = [enemyP, ...(enemyP2 === undefined ? [] : [enemyP2])]
  const participants = [playerP, ...enemies]
  const { combat, runtime } = makeWorld(participants)

  return {
    battle: { players: [playerP], enemies, state: 'fighting' },
    playerP,
    enemyP,
    enemyP2,
    participants,
    combat,
    runtime,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('TheEconomy — pool cap', () => {
  it('theCap falls back to MAX_THE; an entity-baked maxThe wins', () => {
    const entity = createCombatant()

    expect(theCap(entity)).toBe(MAX_THE)

    entity.maxThe = MAX_THE + 20
    expect(theCap(entity)).toBe(MAX_THE + 20)
  })

  it('grantThe clamps at the cap', () => {
    const entity = createCombatant()

    entity.currentThe = 95
    grantThe(entity, 20)
    expect(entity.currentThe).toBe(MAX_THE)

    entity.maxThe = 120
    grantThe(entity, 20)
    expect(entity.currentThe).toBe(120)
  })
})

describe('observation income (Ung The beta)', () => {
  it('own Tham The landed -> gainOnBasicHit (+4) at action end', () => {
    const { battle, playerP, combat, runtime } = makeBattle()
    runtime.applyBuff('ung_the', playerP)

    const system = new TurnBattleSystem(combat, 10, BUFF_REGISTRY, undefined, runtime)
    system.resolveNextStep(battle) // player's tham_the lands on the enemy

    expect(playerP.entity.currentThe).toBe(4)
    expect(theGainOnBasicHit(runtime.buffs.getCapabilities(playerP.entity.id))).toBe(4)
    // The cast planted the Tham mark on the declared target.
    expect(playerP.thamTargetId).toBe('enemy')
  })

  it('observed enemy completing a natural action -> gainOnObservedAction (+4) per observing reactor', () => {
    const { battle, playerP, combat, runtime } = makeBattle()
    runtime.applyBuff('ung_the', playerP)

    const system = new TurnBattleSystem(combat, 10, BUFF_REGISTRY, undefined, runtime)
    system.resolveNextStep(battle) // player marks the enemy (+4)
    expect(playerP.entity.currentThe).toBe(4)

    system.resolveNextStep(battle) // enemy (observed) acts -> +4 at action end
    expect(playerP.entity.currentThe).toBe(8)
    expect(theGainOnObservedAction(runtime.buffs.getCapabilities(playerP.entity.id))).toBe(4)
  })

  it('unobserved enemy actions yield nothing — no mark, no income', () => {
    const { battle, playerP, enemyP, combat, runtime } = makeBattle()
    // Ung_the marker but the enemy is NOT marked (player never cast).
    runtime.applyBuff('ung_the', playerP)
    playerP.thamTargetId = undefined

    // Speed lives on baseStats — force the enemy first this round.
    enemyP.entity.baseStats = asBaseStats({ ...enemyP.entity.baseStats, speed: 30 })
    enemyP.entity.stats = { ...enemyP.entity.stats, speed: 30 }
    enemyP.speed = 30

    const system = new TurnBattleSystem(combat, 10, BUFF_REGISTRY, undefined, runtime)
    system.resolveNextStep(battle) // enemy acts, not observed

    expect(playerP.entity.currentThe ?? 0).toBe(0)
    expect(enemyP.entity.currentThe ?? 0).toBe(0)
  })

  it('a hard-CC-blocked observed enemy yields NO income — the consumed turn completed no action', () => {
    const { battle, playerP, enemyP, combat, runtime } = makeBattle()
    runtime.applyBuff('ung_the', playerP)
    // Pre-plant the Tham mark on the enemy so it IS observed.
    playerP.thamTargetId = 'enemy'
    runtime.applyBuff('choang', enemyP) // stun: its turn is consumed by hard CC

    // Enemy acts first — its ccBlocked declaration carries a natural
    // actionSource, so only the ccBlocked gate keeps income from firing.
    enemyP.entity.baseStats = asBaseStats({ ...enemyP.entity.baseStats, speed: 30 })
    enemyP.entity.stats = { ...enemyP.entity.stats, speed: 30 }
    enemyP.speed = 30

    const system = new TurnBattleSystem(combat, 10, BUFF_REGISTRY, undefined, runtime)
    system.resolveNextStep(battle)

    expect(playerP.entity.currentThe ?? 0).toBe(0)
  })

  it('NO passive income: a full round grants nothing beyond observation channels', () => {
    const { battle, playerP, combat, runtime } = makeBattle()
    runtime.applyBuff('ung_the', playerP)

    const system = new TurnBattleSystem(combat, 10, BUFF_REGISTRY, undefined, runtime)
    system.resolveNextStep(battle) // player basic +4, marks enemy
    system.resolveNextStep(battle) // enemy observed action +4 -> round boundary grants NOTHING

    // Exactly the two observation channels — the retired gainPerRound is gone.
    expect(playerP.entity.currentThe).toBe(8)
  })

  it('Tham An marks on MISS: the dodged cast still observes, income still lands', () => {
    const { battle, playerP, enemyP, combat, runtime } = makeBattle()
    runtime.applyBuff('ung_the', playerP)
    // Enemy dodges everything — the tham_the hit whiffs. The 0.999
    // roll beats the 5% hit floor deterministically.
    enemyP.entity.baseStats = asBaseStats({ ...enemyP.entity.baseStats, evasionRate: 1_000_000 })
    enemyP.entity.stats = { ...enemyP.entity.stats, evasionRate: 1_000_000 }
    vi.spyOn(Math, 'random').mockReturnValue(0.999)

    const system = new TurnBattleSystem(combat, 10, BUFF_REGISTRY, undefined, runtime)
    system.resolveNextStep(battle) // dodged cast: mark planted, NO landed income
    expect(playerP.entity.currentThe ?? 0).toBe(0)
    expect(playerP.thamTargetId).toBe('enemy')

    system.resolveNextStep(battle) // enemy still observed -> +4
    expect(playerP.entity.currentThe).toBe(4)
  })

  it('recast TRANSFERS the single focus; the dropped target stops yielding', () => {
    const { battle, playerP, enemyP, enemyP2, combat, runtime } = makeBattle(2)
    runtime.applyBuff('ung_the', playerP)

    const system = new TurnBattleSystem(combat, 10, BUFF_REGISTRY, undefined, runtime)
    // Force the player's basic onto enemy2: enemy1 speed-gated out.
    system.resolveNextStep(battle) // tham_the -> first target (enemy)
    expect(playerP.thamTargetId).toBe('enemy')

    // Manually re-mark enemy2 (simulating a recast's declared target).
    playerP.thamTargetId = 'enemy2'
    playerP.entity.currentThe = 0

    system.resolveNextStep(battle) // enemy (unmarked now) acts -> no income
    system.resolveNextStep(battle) // enemy2 (marked) acts -> +4
    expect(playerP.entity.currentThe).toBe(4)
    expect(enemyP.entity.currentThe ?? 0).toBe(0)
    void enemyP2
  })

  it('dead mark kills focus with NO auto-transfer', () => {
    const { battle, playerP, enemyP, enemyP2, combat, runtime } = makeBattle(2)
    runtime.applyBuff('ung_the', playerP)

    const system = new TurnBattleSystem(combat, 10, BUFF_REGISTRY, undefined, runtime)
    system.resolveNextStep(battle) // mark enemy

    // Kill the marked enemy mid-battle and let its (skipped) turn pass.
    enemyP.entity.currentHp = 0
    enemyP.entity.alive = false
    playerP.entity.currentThe = 0

    system.resolveNextStep(battle) // enemy2 acts, NOT observed
    expect(playerP.entity.currentThe ?? 0).toBe(0)
    expect(playerP.thamTargetId).toBeUndefined()
    void enemyP2
  })
})

describe('INV-10 — income never funds the action that earned it', () => {
  it('the observed enemy action income lands AFTER its own Phan window closed', () => {
    const { battle, playerP, enemyP, combat, runtime } = makeBattle()
    runtime.applyBuff('ung_the', playerP)
    runtime.applyBuff('phan_mon', playerP)
    playerP.entity.baseStats = asBaseStats({ ...playerP.entity.baseStats, counterChance: 1 })
    playerP.entity.stats = { ...playerP.entity.stats, counterChance: 1 }

    const system = new TurnBattleSystem(combat, 10, BUFF_REGISTRY, undefined, runtime)

    // Pre-planted mark; pool exactly one observed-action income short
    // of the proc cost. The enemy acts twice in a row (speed authority
    // is baseStats): the first action cannot fund its own reaction, the
    // second can.
    playerP.thamTargetId = 'enemy'
    playerP.entity.currentThe = THE_PROC_COST - 4
    enemyP.entity.baseStats = asBaseStats({ ...enemyP.entity.baseStats, speed: 30 })
    enemyP.entity.stats = { ...enemyP.entity.stats, speed: 30 }
    enemyP.speed = 30
    vi.spyOn(Math, 'random').mockReturnValue(0)

    system.resolveNextStep(battle) // enemy action 1: window unaffordable, income lands last

    // Phan could not afford (11 < 15): no queue, no payment; income
    // landed afterwards taking the pool to exactly THE_PROC_COST.
    expect(battle.queuedFollowUps ?? []).toHaveLength(0)
    expect(playerP.entity.currentThe).toBe(THE_PROC_COST)
    expect(playerP.reactionDebt ?? 0).toBe(0)

    system.resolveNextStep(battle) // enemy action 2: NOW the window funds

    // 15 - 15 paid + 4 income = 4.
    expect(playerP.entity.currentThe).toBe(4)
    expect(playerP.reactionDebt).toBe(1)
    expect(battle.queuedFollowUps?.some((entry) => entry.payloadSkillId === 'phan_kich')).toBe(true)
  })
})

describe('Ung Tre / Qua The (reaction debt)', () => {
  it('each committed reaction adds debt + the gauge penalty; a natural action resets it', () => {
    const { battle, playerP, enemyP, combat, runtime } = makeBattle()
    runtime.applyBuff('ung_the', playerP)
    runtime.applyBuff('phan_mon', playerP)
    playerP.entity.baseStats = asBaseStats({ ...playerP.entity.baseStats, counterChance: 1 })
    playerP.entity.stats = { ...playerP.entity.stats, counterChance: 1 }
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const system = new TurnBattleSystem(combat, 10, BUFF_REGISTRY, undefined, runtime)
    playerP.entity.currentThe = THE_PROC_COST * REACTION_DEBT_CAP + 10
    playerP.thamTargetId = 'enemy'
    playerP.reactionDebt = 2

    system.resolveNextStep(battle) // player natural action resets debt (0) + lands +4
    expect(playerP.reactionDebt).toBe(0)
    expect(playerP.entity.currentThe).toBe(THE_PROC_COST * REACTION_DEBT_CAP + 10 + 4)

    // Force the enemy's gauge so IT — not the player — acts next.
    enemyP.actionGauge = 10_000
    playerP.actionGauge = 500
    system.resolveNextStep(battle) // enemy hits -> Phan commits: -15, +1 debt, -400 gauge
    // Pool: (55+4) - 15 paid + 4 observed income = 48.
    expect(playerP.entity.currentThe).toBe(THE_PROC_COST * REACTION_DEBT_CAP + 10 - THE_PROC_COST + 8)
    expect(playerP.reactionDebt).toBe(1)
    // Gauge: 500 - 400 penalty; the pacing loop may accrue one speed
    // tick before the impact, so pin the penalty as a tight range.
    expect(playerP.actionGauge).toBeGreaterThan(500 - UNG_TRE_GAUGE_PENALTY - 1)
    expect(playerP.actionGauge).toBeLessThanOrEqual(500 - UNG_TRE_GAUGE_PENALTY + playerP.speed)
  })

  it('Qua The at the cap blocks new windows — income still lands, no payment', () => {
    const { battle, playerP, enemyP, combat, runtime } = makeBattle()
    runtime.applyBuff('ung_the', playerP)
    runtime.applyBuff('phan_mon', playerP)
    playerP.entity.baseStats = asBaseStats({ ...playerP.entity.baseStats, counterChance: 1 })
    playerP.entity.stats = { ...playerP.entity.stats, counterChance: 1 }
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const system = new TurnBattleSystem(combat, 10, BUFF_REGISTRY, undefined, runtime)
    playerP.entity.currentThe = THE_PROC_COST * REACTION_DEBT_CAP + 10
    playerP.thamTargetId = 'enemy'
    playerP.reactionDebt = REACTION_DEBT_CAP
    enemyP.actionGauge = 10_000 // the ENEMY acts first — the player's own action would reset the debt

    system.resolveNextStep(battle) // enemy acts: window closed by Qua The
    expect(battle.queuedFollowUps ?? []).toHaveLength(0)
    expect(playerP.reactionDebt).toBe(REACTION_DEBT_CAP)
    // Income still lands — Qua The only blocks reactions.
    expect(playerP.entity.currentThe).toBe(THE_PROC_COST * REACTION_DEBT_CAP + 10 + 4)
  })
})

describe('Dan The one-shot (Dẫn Thế node)', () => {
  it('a marked enemy\'s next OBSERVED action yields x3 income, then the mark is consumed', () => {
    const { battle, playerP, enemyP, combat, runtime } = makeBattle()
    runtime.applyBuff('ung_the', playerP)
    runtime.applyBuff('dan_the', enemyP)

    const system = new TurnBattleSystem(combat, 10, BUFF_REGISTRY, undefined, runtime)
    system.resolveNextStep(battle) // player marks enemy (+4)
    expect(playerP.entity.currentThe).toBe(4)

    system.resolveNextStep(battle) // enemy observed action: +4 x DAN_THE_INCOME_MULT, mark consumed
    expect(playerP.entity.currentThe).toBe(4 + 4 * DAN_THE_INCOME_MULT)
    expect(runtime.buffs.getForTarget(enemyP.entity.id).some((inst) => inst.definitionId === 'dan_the')).toBe(false)

    system.resolveNextStep(battle) // player turn
    system.resolveNextStep(battle) // enemy observed action -> plain +4 (mark gone)
    expect(playerP.entity.currentThe).toBe(4 + 4 * DAN_THE_INCOME_MULT + 4 + 4)
  })
})
