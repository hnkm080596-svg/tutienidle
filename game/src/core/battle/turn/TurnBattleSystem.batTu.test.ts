import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { asBaseStats, createBaseStats } from '../../stats/StatBlock'
import { BuffPool } from '../../buff/BuffPool'
import { BuffSystem } from '../../buff/BuffSystem'
import { BUFF_REGISTRY } from '../../../data/buff/BuffRegistry'
import { BAT_TU_BA_THE, CUONG_QUYEN, LOAN_DAU } from '../../../data/skill/TheTuSkills'
import { BAT_TU_BA_THE_BUFF } from '../../../data/buff/TheTuBuffs'
import { TheTuBatTuSurvival } from '../../the-tu/TheTuBatTuSurvival'
import { SurviveLethalGuard } from '../../talent/SurviveLethalGuard'
import { selectAction } from './TurnSkillAction'
import type { BuffDefinition } from '../../buff/BuffTypes'

// The Tu Reimagined (spec 2026-09-15 section 5.1, plan Task 9,
// D9/D10/INV-4/5) — Bat Tu Ba The survival contract: lethal -> HP 1 ->
// bat_tu_ba_the buff for the holder's own turns + ultimate cooldown
// consumed; an active buff means FREE survive (no re-grant, no refresh);
// the talent guard stays the second line when the ult is spent.

function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0 })

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
  return { id, entity, speed, priority, actionGauge: 0, alive: entity.alive, buffs: new BuffPool(), consecutiveHardCcTurns: 0 }
}

const STUN: BuffDefinition = {
  id: 'fixture_stun',
  name: 'Stun',
  polarity: 'debuff',
  duration: 5,
  stackMode: 'refresh',
  effects: [{ type: 'cc', ccEffect: 'stun' }],
}

// Non-cc debuff (poison/dot) — must survive BOTH the lethal grant and
// repeat lethals inside the Bat Tu window: only hard CC is cleansed,
// via clearsCcOnApply on the grant path.
const POISON: BuffDefinition = {
  id: 'fixture_poison',
  name: 'Poison',
  polarity: 'debuff',
  duration: 5,
  stackMode: 'refresh',
  effects: [{ type: 'dot', dpsRatio: 0.2 }],
}

const TU_SINH_NGO: BuffDefinition = {
  id: 'tu_sinh_ngo',
  name: 'Tu Sinh Ngo',
  polarity: 'buff',
  duration: 1,
  stackMode: 'refresh',
  effects: [],
}

class FixtureRegistry {
  constructor(private readonly defs: BuffDefinition[]) {}
  get(id: string): BuffDefinition {
    const def = this.defs.find((candidate) => candidate.id === id)
    if (!def) throw new Error(`unknown buff id "${id}"`)
    return def
  }
}

const REGISTRY = new FixtureRegistry([BAT_TU_BA_THE_BUFF, STUN, POISON, TU_SINH_NGO])

function makeTheTuParticipant(id: string, entity: CombatEntity): TurnBattleParticipant {
  const participant = makeParticipant(id, entity, 10, 0)
  participant.basic = CUONG_QUYEN
  participant.special = { skill: LOAN_DAU, remainingCooldownTurns: 0 }
  participant.ultimate = { skill: BAT_TU_BA_THE, remainingCooldownTurns: 0 }
  return participant
}

function makeCombatWithSession(player: TurnBattleParticipant, guard: SurviveLethalGuard) {
  const combat = new CombatSystem(new EventBus())
  combat.setSurviveLethalSession({
    playerEntityId: player.entity.id,
    guard,
    surviveEffects: {
      buffSystem: new BuffSystem(player.buffs),
      registry: REGISTRY,
      grantBuffId: 'tu_sinh_ngo',
      cleanseDebuffs: true,
    },
    extraSources: [
      new TheTuBatTuSurvival({
        ultimateSlot: () => player.ultimate,
        buffs: player.buffs,
      }),
    ],
  })
  return combat
}

function makeEnemy(id: string, might = 999_999): CombatEntity {
  return createCombatant({
    id,
    stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might, defense: 0, endurancePercent: 0, blockChance: 0 }),
    currentHp: 1_000_000,
    maxHp: 1_000_000,
  })
}

describe('Bat Tu Ba The survival contract (D9/D10/INV-4/5)', () => {
  it('lethal hit at low HP -> survives at 1, buff granted for 3 own-turns, ult CD started', () => {
    const player = makeTheTuParticipant('player', createCombatant({ id: 'player', type: 'player', currentHp: 50, maxHp: 1_000 }))
    const combat = makeCombatWithSession(player, new SurviveLethalGuard())

    combat.applyDirectDamage(player.entity, 9_999, 'enemy')

    expect(player.entity.alive).toBe(true)
    expect(player.entity.currentHp).toBe(1)
    const buff = player.buffs.getAllById('bat_tu_ba_the')[0]
    expect(buff).toBeDefined()
    expect(buff!.remainingTurns).toBe(3)
    expect(player.ultimate!.remainingCooldownTurns).toBe(BAT_TU_BA_THE.cooldownTurns)
  })

  it('repeat lethal while buffed -> free survive, NO duration refresh, NO CD touch', () => {
    const player = makeTheTuParticipant('player', createCombatant({ id: 'player', type: 'player', currentHp: 50, maxHp: 1_000 }))
    const combat = makeCombatWithSession(player, new SurviveLethalGuard())

    // Buff already active at 2 remaining turns — a re-grant would reset to 3.
    new BuffSystem(player.buffs).apply(BAT_TU_BA_THE_BUFF, player.entity, player.entity, REGISTRY)
    player.buffs.getAllById('bat_tu_ba_the')[0]!.remainingTurns = 2
    player.ultimate!.remainingCooldownTurns = 4 // ticking down from an earlier trigger

    combat.applyDirectDamage(player.entity, 9_999, 'enemy')

    expect(player.entity.alive).toBe(true)
    expect(player.entity.currentHp).toBe(1)
    expect(player.buffs.getAllById('bat_tu_ba_the')).toHaveLength(1)
    expect(player.buffs.getAllById('bat_tu_ba_the')[0]!.remainingTurns).toBe(2)
    expect(player.ultimate!.remainingCooldownTurns).toBe(4)
  })

  it('lethal while ult on CD and no talent -> dies', () => {
    const player = makeTheTuParticipant('player', createCombatant({ id: 'player', type: 'player', currentHp: 50, maxHp: 1_000 }))
    player.ultimate!.remainingCooldownTurns = 5
    const combat = makeCombatWithSession(player, new SurviveLethalGuard())

    combat.applyDirectDamage(player.entity, 9_999, 'enemy')

    expect(player.entity.alive).toBe(false)
  })

  it('talent guard stacks as the second line when the ult is exhausted', () => {
    const player = makeTheTuParticipant('player', createCombatant({ id: 'player', type: 'player', currentHp: 50, maxHp: 1_000 }))
    player.ultimate!.remainingCooldownTurns = 5
    const guard = new SurviveLethalGuard()
    guard.beginBattle(['bat_tu_the']) // talent id -> 1 use (getSurviveLethalUsesPerBattle)
    const combat = makeCombatWithSession(player, guard)

    combat.applyDirectDamage(player.entity, 9_999, 'enemy')

    expect(player.entity.alive).toBe(true)
    expect(player.entity.currentHp).toBe(1)
    expect(guard.getRemainingUses()).toBe(0)
    // Talent path grants its own buff id, not bat_tu_ba_the.
    expect(player.buffs.getAllById('bat_tu_ba_the')).toHaveLength(0)
  })

  it('node-scaled duration reaches the lethal grant via the slot application', () => {
    const player = makeTheTuParticipant('player', createCombatant({ id: 'player', type: 'player', currentHp: 50, maxHp: 1_000 }))
    // Participant-build clone carries the resolved override (base 3 + 1 node).
    player.ultimate = {
      skill: {
        ...BAT_TU_BA_THE,
        appliesBuffs: [{ definitionId: 'bat_tu_ba_the', target: 'self', durationOverride: 4 }],
      },
      remainingCooldownTurns: 0,
    }
    const combat = makeCombatWithSession(player, new SurviveLethalGuard())

    combat.applyDirectDamage(player.entity, 9_999, 'enemy')

    expect(player.entity.alive).toBe(true)
    expect(player.buffs.getAllById('bat_tu_ba_the')[0]!.remainingTurns).toBe(4)
  })

  it('lethal grant cleanses an active stun (clearsCcOnApply on the grant path)', () => {
    const player = makeTheTuParticipant('player', createCombatant({ id: 'player', type: 'player', currentHp: 50, maxHp: 1_000 }))
    new BuffSystem(player.buffs).apply(STUN, makeEnemy('dummy'), player.entity, REGISTRY)
    const combat = makeCombatWithSession(player, new SurviveLethalGuard())

    combat.applyDirectDamage(player.entity, 9_999, 'enemy')

    expect(player.entity.alive).toBe(true)
    expect(player.buffs.getAllById('fixture_stun')).toHaveLength(0)
  })

  it('cleanses hard CC only — non-cc debuffs survive the grant AND repeat lethals in the window', () => {
    const player = makeTheTuParticipant('player', createCombatant({ id: 'player', type: 'player', currentHp: 50, maxHp: 1_000 }))
    const buffs = new BuffSystem(player.buffs)
    buffs.apply(STUN, makeEnemy('dummy'), player.entity, REGISTRY)
    buffs.apply(POISON, makeEnemy('dummy'), player.entity, REGISTRY)
    const combat = makeCombatWithSession(player, new SurviveLethalGuard())

    // First lethal: grant strips the stun via clearsCcOnApply; the
    // poison is a non-cc debuff and must NOT be blanket-cleansed.
    combat.applyDirectDamage(player.entity, 9_999, 'enemy')

    expect(player.entity.alive).toBe(true)
    expect(player.buffs.getAllById('fixture_stun')).toHaveLength(0)
    expect(player.buffs.getAllById('fixture_poison')).toHaveLength(1)
    expect(player.buffs.getAllById('bat_tu_ba_the')).toHaveLength(1)

    // Second lethal inside the window: the already-active free survive
    // used to return no cleanseDebuffs -> undefined !== false wiped
    // every debuff. It must leave the poison untouched.
    combat.applyDirectDamage(player.entity, 9_999, 'enemy')

    expect(player.entity.alive).toBe(true)
    expect(player.entity.currentHp).toBe(1)
    expect(player.buffs.getAllById('fixture_poison')).toHaveLength(1)
  })

  it('active buff suppresses hard-CC blocking without touching consecutiveHardCcTurns', () => {
    const player = makeTheTuParticipant('player', createCombatant({ id: 'player', type: 'player', currentHp: 500, maxHp: 1_000 }))
    const enemyP = makeParticipant('enemy', makeEnemy('enemy', 0), 8, 100)
    const battle: TurnBattle = { players: [player], enemies: [enemyP], state: 'fighting' }

    new BuffSystem(player.buffs).apply(STUN, enemyP.entity, player.entity, REGISTRY)
    new BuffSystem(player.buffs).apply(BAT_TU_BA_THE_BUFF, player.entity, player.entity, REGISTRY)
    player.consecutiveHardCcTurns = 2
    // Ult+special on cooldown so the unblocked action is the basic.
    player.ultimate!.remainingCooldownTurns = 8
    player.special!.remainingCooldownTurns = 4

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, REGISTRY)
    const step = system.resolveNextStep(battle)

    // Buffed: the stun cannot block — the actor still acts (basic hit).
    expect(step.ccBlocked).toBe(false)
    expect(step.skillId).toBe('cuong_quyen')
    // Suppressed, NOT reset: the counter resumes accumulating post-expiry.
    expect(player.consecutiveHardCcTurns).toBe(2)
  })

  it('manual cast applies the buff through the appliesBuffs path', () => {
    // A stunned actor cannot cast at all — clearsCcOnApply on a self-buff
    // is only reachable through the lethal grant (covered above). The
    // manual path just proves the skill applies its own buff.
    const player = makeTheTuParticipant('player', createCombatant({ id: 'player', type: 'player', currentHp: 500, maxHp: 1_000 }))
    const enemyP = makeParticipant('enemy', makeEnemy('enemy', 0), 8, 100)
    const battle: TurnBattle = { players: [player], enemies: [enemyP], state: 'fighting' }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, REGISTRY)
    const step = system.resolveNextStep(battle)

    expect(step.skillId).toBe('bat_tu_ba_the')
    expect(player.buffs.getAllById('bat_tu_ba_the')).toHaveLength(1)
    expect(player.ultimate!.remainingCooldownTurns).toBe(8)
  })

  it('selectAction DOES auto-pick the ultimate when off-CD (T11-accepted, do not gate)', () => {
    const player = makeTheTuParticipant('player', createCombatant({ id: 'player', type: 'player' }))
    expect(selectAction(player).skillId).toBe('bat_tu_ba_the')
  })

  it('own-turn lethal DoT -> Bat Tu fires -> committed ult CD does NOT tick again that same turn', () => {
    const player = makeTheTuParticipant('player', createCombatant({ id: 'player', type: 'player', currentHp: 50, maxHp: 1_000 }))
    const enemyP = makeParticipant('enemy', makeEnemy('enemy', 0), 8, 100)
    const battle: TurnBattle = { players: [player], enemies: [enemyP], state: 'fighting' }
    const combat = makeCombatWithSession(player, new SurviveLethalGuard())

    // Lethal poison ticking on the holder's OWN turn: a might-999k source
    // x dpsRatio 0.2 resolves ~200k damagePerTurn at apply — far over 50 HP.
    new BuffSystem(player.buffs).apply(POISON, makeEnemy('dummy'), player.entity, REGISTRY)

    const system = new TurnBattleSystem(combat, 10, REGISTRY)
    system.declareActorAction(battle, player)

    expect(player.entity.alive).toBe(true)
    expect(player.entity.currentHp).toBe(1)
    expect(player.buffs.getAllById('bat_tu_ba_the')).toHaveLength(1)
    // The survival source committed the full 8-turn cooldown DURING this
    // turn's status phase (inside BuffSystem.update); the same turn's
    // cooldown tick must not drop it to 7 — the regression this guards.
    expect(player.ultimate!.remainingCooldownTurns).toBe(8)

    // Next own turn: the poison ticks lethal again inside the still-active
    // Bat Tu window (free survive — no new commit), so the cooldown DOES
    // tick down to 7. The first turn's skip was a same-turn exemption,
    // not a freeze.
    system.declareActorAction(battle, player)

    expect(player.entity.alive).toBe(true)
    expect(player.buffs.getAllById('bat_tu_ba_the')).toHaveLength(1)
    expect(player.ultimate!.remainingCooldownTurns).toBe(7)
  })

  it('enemy-turn lethal commits CD=8 -> the holder\'s NEXT own turn still ticks it to 7', () => {
    const player = makeTheTuParticipant('player', createCombatant({ id: 'player', type: 'player', currentHp: 50, maxHp: 1_000 }))
    const enemyP = makeParticipant('enemy', makeEnemy('enemy', 0), 8, 100)
    const battle: TurnBattle = { players: [player], enemies: [enemyP], state: 'fighting' }
    const combat = makeCombatWithSession(player, new SurviveLethalGuard())

    // Enemy-turn lethal: the commit happens outside any status phase of
    // the holder, so the full cooldown stands and counts down normally.
    combat.applyDirectDamage(player.entity, 9_999, 'enemy')

    expect(player.entity.alive).toBe(true)
    expect(player.ultimate!.remainingCooldownTurns).toBe(8)

    const system = new TurnBattleSystem(combat, 10, REGISTRY)
    system.declareActorAction(battle, player)

    expect(player.entity.alive).toBe(true)
    expect(player.ultimate!.remainingCooldownTurns).toBe(7)
  })
})
