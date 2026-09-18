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
import { BUFF_REGISTRY } from '../../../data/buff/BuffRegistry'
import { buffs as LIVE_BUFFS } from '../../../data/buff/buffs'
import { TRO_KICH } from '../../../data/skill/TheTuSkills'
import { THE_PROC_COST, THE_PROC_GAIN } from '../../the-tu/TheEconomy'
import type { BuffDefinition } from '../../buff2/BuffDefinition'
import type { BuffRegistry } from '../../buff2/BuffRegistry'
import type { ReactiveProcPayload } from '../../proc/ProcCapabilities'
import type { TurnSkillDefinition } from './TurnSkillAction'
import type { TurnRuntimeFixture } from './testing/TurnRuntimeFixtures'
import { makeTestBuffRegistry, makeTurnRuntime } from './testing/TurnRuntimeFixtures'

// The Tu Reimagined (spec 6.2.2/6.2.3, plan Task 18) — the Phan taken
// window and the Tro ally-action window. Phan: a LANDED hit with
// hpDamage > 0 rolls the defender's onImpactLanded proc (fully absorbed
// is not "taken"). Tro: a player-side action that landed >=1 damaging
// hit gives OTHER living player-side tro_mon holders one roll each,
// queueing tro_kich against the whole landed set — never on the actor's
// own action and never on reactive actions (INV-9).

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

const BASIC: TurnSkillDefinition = {
  id: 'hit',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 1 },
  targeting: { shape: 'single' },
}

function makeParticipant(id: string, entity: CombatEntity, speed: number, priority: number): TurnBattleParticipant {
  return { id, entity, speed, priority, actionGauge: 0, alive: entity.alive, consecutiveHardCcTurns: 0 }
}

/** Clone a marker def with hand-baked reactive_proc economy fields —
    the same capability-payload writes buildTheTuAnKit performs (the
    base registry marker carries no theCost/theGainOnSuccess). */
function markerClone(
  base: BuffDefinition,
  bake?: (payload: ReactiveProcPayload) => void,
): BuffDefinition {
  const clone = structuredClone(base)
  for (const capability of clone.capabilities ?? []) {
    if (capability.type === 'reactive_proc') {
      bake?.(capability.payload as ReactiveProcPayload)
    }
  }
  return clone
}

/** Live-data registry with the given defs swapped in under their own
    ids — the kit-clone seam the battle-local registry performs. */
function registryWith(replacements: readonly BuffDefinition[]): BuffRegistry {
  const byId = new Map(replacements.map((def) => [def.id, def]))
  return makeTestBuffRegistry(LIVE_BUFFS.map((def) => byId.get(def.id) ?? def))
}

interface World {
  combat: CombatSystem
  registry: BuffRegistry
  runtime: TurnRuntimeFixture
}

function world(
  participants: () => readonly TurnBattleParticipant[],
  registry: BuffRegistry = BUFF_REGISTRY,
): World {
  const combat = new CombatSystem(new EventBus())
  const runtime = makeTurnRuntime({ registry, participants, combatSystem: combat })
  return { combat, registry, runtime }
}

function systemOf(w: World): TurnBattleSystem {
  return new TurnBattleSystem(w.combat, 10_000, w.registry, undefined, w.runtime)
}

function withMarker(
  w: World,
  p: TurnBattleParticipant,
  buffId: 'phan_mon' | 'tro_mon' | 'ung_the',
  chanceStat: 'counterChance' | 'followUpChance',
  chance: number,
  currentThe: number,
): TurnBattleParticipant {
  p.entity.baseStats = asBaseStats({ ...p.entity.baseStats, [chanceStat]: chance })
  p.entity.stats = { ...p.entity.stats, [chanceStat]: chance }
  p.entity.currentThe = currentThe
  w.runtime.applyBuff(buffId, p)
  return p
}

function declaredAction(
  actorId: string,
  skill: TurnSkillDefinition,
  affected: TurnBattleParticipant[],
  opposingSide: TurnBattleParticipant[],
  actionSource: TurnDeclaredAction['actionSource'] = 'normal',
): TurnDeclaredAction {
  return {
    actorId,
    skillId: skill.id,
    ccBlocked: false,
    isCharging: false,
    chargeResolved: false,
    chargeTargetIds: [],
    chargedSkill: null,
    action: {
      skillId: skill.id,
      skill,
      damage: skill.damage,
      targeting: skill.targeting,
      slot: null,
    },
    opposingSide,
    affected,
    scaledDamage: skill.damage ?? null,
    suddenDeathMultiplier: 1,
    compositePickedSkills: null,
    isFollowUpBypass: false,
    actionSource,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Phan taken window (spec 6.2.2)', () => {
  it('a fully absorbed hit (hpDamage=0, not dodged) rolls NO Phan proc', () => {
    const enemy = createCombatant({ id: 'enemy' })
    const defender = createCombatant({ id: 'defender', type: 'player', currentHp: 100_000, maxHp: 100_000 })
    const enemyP = makeParticipant('enemy', enemy, 10, 100)
    const defenderP = makeParticipant('defender', defender, 5, 0)
    const battle: TurnBattle = { players: [defenderP], enemies: [enemyP], state: 'fighting' }
    const w = world(() => [defenderP, enemyP])
    withMarker(w, defenderP, 'phan_mon', 'counterChance', 1, 100)
    defenderP.entity.currentWard = 100_000 // absorbs the whole hit
    vi.spyOn(Math, 'random').mockReturnValue(0)

    systemOf(w).applyActionImpact(battle, declaredAction('enemy', BASIC, [defenderP], battle.players))

    expect(battle.queuedFollowUps).toBeUndefined()
    expect(defenderP.entity.currentThe).toBe(100) // no attempt at all
  })

  it('taken-hit income lands BEFORE the window: 10 + 6 funds this hit\'s counter check', () => {
    const enemy = createCombatant({ id: 'enemy' })
    const defender = createCombatant({ id: 'defender', type: 'player', currentHp: 100_000, maxHp: 100_000 })
    const enemyP = makeParticipant('enemy', enemy, 10, 100)
    const defenderP = makeParticipant('defender', defender, 5, 0)
    const battle: TurnBattle = { players: [defenderP], enemies: [enemyP], state: 'fighting' }
    const registry = registryWith([
      markerClone(BUFF_REGISTRY.get('phan_mon'), (payload) => {
        payload.theCost = THE_PROC_COST
        payload.theGainOnSuccess = THE_PROC_GAIN
      }),
    ])
    const w = world(() => [defenderP, enemyP], registry)
    // ung_the supplies the +6 taken income; phan_mon the counter proc.
    withMarker(w, defenderP, 'ung_the', 'counterChance', 1, 10)
    withMarker(w, defenderP, 'phan_mon', 'counterChance', 1, 10)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    systemOf(w).applyActionImpact(battle, declaredAction('enemy', BASIC, [defenderP], battle.players))

    // 10 + 6 (taken income) = 16 >= 15 -> paid, rolled, +20 success.
    expect(battle.queuedFollowUps).toHaveLength(1)
    expect(defenderP.entity.currentThe).toBe(21)
  })

  it('a counter on a dead attacker drops — the queue entry is never pushed', () => {
    const enemy = createCombatant({ id: 'enemy', alive: false })
    const defender = createCombatant({ id: 'defender', type: 'player', currentHp: 100_000, maxHp: 100_000 })
    const enemyP = makeParticipant('enemy', enemy, 10, 100)
    enemyP.entity = { ...enemyP.entity, alive: false }
    enemyP.alive = false
    const defenderP = makeParticipant('defender', defender, 5, 0)
    const battle: TurnBattle = { players: [defenderP], enemies: [enemyP], state: 'fighting' }
    const registry = registryWith([
      markerClone(BUFF_REGISTRY.get('phan_mon'), (payload) => {
        payload.theCost = THE_PROC_COST
        payload.theGainOnSuccess = THE_PROC_GAIN
      }),
    ])
    const w = world(() => [defenderP, enemyP], registry)
    withMarker(w, defenderP, 'phan_mon', 'counterChance', 1, 100)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    systemOf(w).applyActionImpact(battle, declaredAction('enemy', BASIC, [defenderP], battle.players))

    // Roll succeeded but targetMode 'attacker' resolved to a dead actor.
    expect(battle.queuedFollowUps).toBeUndefined()
  })
})

describe('Tro ally-action window (spec 6.2.3)', () => {
  function makeParty(): {
    battle: TurnBattle
    attackerP: TurnBattleParticipant
    supporterP: TurnBattleParticipant
    enemyP: TurnBattleParticipant
    w: World
  } {
    const attacker = createCombatant({ id: 'attacker', type: 'player' })
    const supporter = createCombatant({ id: 'supporter', type: 'player' })
    const enemy = createCombatant({ id: 'enemy', currentHp: 100_000, maxHp: 100_000 })
    const attackerP = makeParticipant('attacker', attacker, 10, 0)
    const supporterP = makeParticipant('supporter', supporter, 5, 1)
    const enemyP = makeParticipant('enemy', enemy, 3, 100)
    supporterP.reactivePayloads = { tro_kich: { ...TRO_KICH } }
    const battle: TurnBattle = {
      players: [attackerP, supporterP],
      enemies: [enemyP],
      state: 'fighting',
    }
    const registry = registryWith([
      markerClone(BUFF_REGISTRY.get('tro_mon'), (payload) => {
        payload.theCost = THE_PROC_COST
        payload.theGainOnSuccess = THE_PROC_GAIN
      }),
    ])
    const w = world(() => [...battle.players, ...battle.enemies], registry)
    return { battle, attackerP, supporterP, enemyP, w }
  }

  it('an ally\'s landed action queues tro_kich on the supporter vs the landed target', () => {
    const { battle, attackerP, supporterP, enemyP, w } = makeParty()
    withMarker(w, supporterP, 'tro_mon', 'followUpChance', 1, 100)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    systemOf(w).applyActionImpact(battle, declaredAction('attacker', BASIC, [enemyP], battle.enemies))

    expect(battle.queuedFollowUps).toHaveLength(1)
    expect(battle.queuedFollowUps![0]).toMatchObject({
      actorId: 'supporter',
      actionSource: 'follow_up',
      payloadSkillId: 'tro_kich',
      targetIds: ['enemy'],
      triggerContext: { origin: 'ally_action' },
    })
    expect(supporterP.entity.currentThe).toBe(100) // 100 - 15 + 20 capped
  })

  it('ally AoE queues Tro against the whole landed set', () => {
    const { battle, attackerP, supporterP, enemyP, w } = makeParty()
    const enemy2 = createCombatant({ id: 'enemy2', currentHp: 100_000, maxHp: 100_000 })
    const enemy2P = makeParticipant('enemy2', enemy2, 3, 101)
    battle.enemies.push(enemy2P)
    withMarker(w, supporterP, 'tro_mon', 'followUpChance', 1, 100)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const aoe: TurnSkillDefinition = { ...BASIC, id: 'aoe', targeting: { shape: 'all_lanes' } }
    systemOf(w).applyActionImpact(battle, declaredAction('attacker', aoe, [enemyP, enemy2P], battle.enemies))

    expect(battle.queuedFollowUps).toHaveLength(1)
    expect(battle.queuedFollowUps![0]!.targetIds).toEqual(['enemy', 'enemy2'])
  })

  it('never triggers on the actor\'s own action — a tro_mon holder acting queues nothing', () => {
    const { battle, attackerP, supporterP, enemyP, w } = makeParty()
    // The ATTACKER carries the marker; only the supporter is other-side.
    withMarker(w, attackerP, 'tro_mon', 'followUpChance', 1, 100)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    systemOf(w).applyActionImpact(battle, declaredAction('attacker', BASIC, [enemyP], battle.enemies))

    expect(battle.queuedFollowUps).toBeUndefined()
    expect(attackerP.entity.currentThe).toBe(100)
    expect(supporterP.entity.currentThe).toBeUndefined()
  })

  it('reactive actions never open the window (INV-9) — a counter payload triggers no Tro', () => {
    const { battle, supporterP, enemyP, w } = makeParty()
    withMarker(w, supporterP, 'tro_mon', 'followUpChance', 1, 100)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const counterAction = declaredAction('attacker', BASIC, [enemyP], battle.enemies, 'counter')
    systemOf(w).applyActionImpact(battle, counterAction)

    expect(battle.queuedFollowUps).toBeUndefined()
    expect(supporterP.entity.currentThe).toBe(100)
  })

  it('a whiffed action (all dodged) opens no window', () => {
    const { battle, supporterP, enemyP, w } = makeParty()
    enemyP.entity.baseStats = asBaseStats({ ...enemyP.entity.baseStats, evasionRate: 1_000_000 })
    enemyP.entity.stats = { ...enemyP.entity.stats, evasionRate: 1_000_000 }
    withMarker(w, supporterP, 'tro_mon', 'followUpChance', 1, 100)
    vi.spyOn(Math, 'random').mockReturnValue(0.999) // dodge roll

    systemOf(w).applyActionImpact(battle, declaredAction('attacker', BASIC, [enemyP], battle.enemies))

    expect(battle.queuedFollowUps).toBeUndefined()
    expect(supporterP.entity.currentThe).toBe(100)
  })

  it('dead landed targets drop out of the queued target set at queue time', () => {
    const { battle, attackerP, supporterP, enemyP, w } = makeParty()
    const enemy2 = createCombatant({ id: 'enemy2', currentHp: 1, maxHp: 1 })
    const enemy2P = makeParticipant('enemy2', enemy2, 3, 101)
    battle.enemies.push(enemy2P)
    withMarker(w, supporterP, 'tro_mon', 'followUpChance', 1, 100)
    // enemy2 dies to the first hit (1 HP), enemy survives — queue only vs enemy.
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const aoe: TurnSkillDefinition = { ...BASIC, id: 'aoe', targeting: { shape: 'all_lanes' } }
    systemOf(w).applyActionImpact(battle, declaredAction('attacker', aoe, [enemyP, enemy2P], battle.enemies))

    expect(battle.queuedFollowUps![0]!.targetIds).toEqual(['enemy'])
    expect(attackerP).toBeDefined()
  })
})
