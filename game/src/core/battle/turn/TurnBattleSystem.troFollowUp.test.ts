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
import { TRO_KICH, buildTheTuAnKit } from '../../../data/skill/TheTuSkills'
import { THE_PROC_COST } from '../../the-tu/TheEconomy'
import type { BuffDefinition } from '../../buff2/BuffDefinition'
import type { BuffRegistry } from '../../buff2/BuffRegistry'
import type { TurnSkillDefinition } from './TurnSkillAction'
import type { TurnRuntimeFixture } from './testing/TurnRuntimeFixtures'
import { makeTestBuffRegistry, makeTurnRuntime } from './testing/TurnRuntimeFixtures'

// Ung The beta (design Parts VI + VIII) — the Phan post-action window
// and the Tro ally-action window. Phan: an observed enemy's natural
// hostile action RESOLVING on the reactor opens one window — hit,
// blocked, absorbed, missed and evaded all qualify; the taken outcome
// rolls onImpactLanded, a fully dodged action rolls onEvade. Tro: an
// ally's authored-DAMAGING natural action completes into an enemy the
// reactor observes -> one window -> tro_kich at the canonical target
// (first landed, else affected, alive + observed). Success pays The
// and commits +1 Ung Tre debt — nothing is spent on a failed roll.

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

interface World {
  combat: CombatSystem
  registry: BuffRegistry
  runtime: TurnRuntimeFixture
}

/** Live-data registry with the given defs swapped in under their own
    ids — the kit-clone seam the battle-local registry performs. */
function registryWith(replacements: readonly BuffDefinition[]): BuffRegistry {
  const byId = new Map(replacements.map((def) => [def.id, def]))
  return makeTestBuffRegistry(LIVE_BUFFS.map((def) => byId.get(def.id) ?? def))
}

/** Kit-baked marker clones under their own ids — e.g. phan_mon carrying
    the Trong Phan payload swap. */
function bakedKitRegistry(mods: Parameters<typeof buildTheTuAnKit>[0]): BuffRegistry {
  const kit = buildTheTuAnKit(mods, { quanThe: true, quanTheCoreLevel: 1 })
  return registryWith(kit.basic.grantsBuffsAtBuild!)
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

function makePhanWorld(): {
  battle: TurnBattle
  enemyP: TurnBattleParticipant
  defenderP: TurnBattleParticipant
  w: World
} {
  const enemy = createCombatant({ id: 'enemy' })
  const defender = createCombatant({ id: 'defender', type: 'player', currentHp: 100_000, maxHp: 100_000 })
  const enemyP = makeParticipant('enemy', enemy, 10, 100)
  const defenderP = makeParticipant('defender', defender, 5, 0)
  defenderP.reactivePayloads = {
    phan_kich: { ...(buildTheTuAnKit().reactivePayloads['phan_kich']!) },
  }
  const battle: TurnBattle = { players: [defenderP], enemies: [enemyP], state: 'fighting' }
  const w = world(() => [defenderP, enemyP])
  withMarker(w, defenderP, 'phan_mon', 'counterChance', 1, 100)
  // The defender OBSERVES the attacker — the mark is the base gate.
  defenderP.thamTargetId = 'enemy'
  return { battle, enemyP, defenderP, w }
}

describe('Phan post-action window (Ung The beta)', () => {
  it('a TAKEN hit rolls onImpactLanded: forced success pays +15 cost, +1 debt, queues phan_kich at the attacker', () => {
    const { battle, defenderP, w } = makePhanWorld()
    vi.spyOn(Math, 'random').mockReturnValue(0)

    systemOf(w).applyActionImpact(battle, declaredAction('enemy', BASIC, [defenderP], battle.players))

    expect(battle.queuedFollowUps).toHaveLength(1)
    expect(battle.queuedFollowUps![0]).toMatchObject({
      actorId: 'defender',
      actionSource: 'counter',
      payloadSkillId: 'phan_kich',
      targetIds: ['enemy'],
      triggerContext: { origin: 'enemy_hit', outcome: 'taken' },
    })
    expect(defenderP.entity.currentThe).toBe(100 - THE_PROC_COST)
    expect(defenderP.reactionDebt).toBe(1)
  })

  it('a fully ABSORBED hit (hpDamage=0) still qualifies — resolution, not HP loss, is the trigger', () => {
    const { battle, defenderP, w } = makePhanWorld()
    defenderP.entity.currentWard = 100_000 // absorbs the whole hit
    vi.spyOn(Math, 'random').mockReturnValue(0)

    systemOf(w).applyActionImpact(battle, declaredAction('enemy', BASIC, [defenderP], battle.players))

    expect(battle.queuedFollowUps).toHaveLength(1)
    expect(battle.queuedFollowUps![0]!.payloadSkillId).toBe('phan_kich')
    expect(defenderP.entity.currentThe).toBe(100 - THE_PROC_COST)
  })

  it('a dodged hit rolls the onEvade grant — still phan_kich without the Trong Phan node', () => {
    const { battle, defenderP, w } = makePhanWorld()
    defenderP.entity.baseStats = asBaseStats({ ...defenderP.entity.baseStats, evasionRate: 1_000_000 })
    defenderP.entity.stats = { ...defenderP.entity.stats, evasionRate: 1_000_000 }
    // The hit channel and the proc roll share the one rng stream:
    // 0.999 dodges past the 5% floor, then 0 succeeds the chance cap.
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.999).mockReturnValue(0)

    systemOf(w).applyActionImpact(battle, declaredAction('enemy', BASIC, [defenderP], battle.players))

    expect(battle.queuedFollowUps).toHaveLength(1)
    expect(battle.queuedFollowUps![0]).toMatchObject({
      payloadSkillId: 'phan_kich',
      triggerContext: { origin: 'enemy_hit', outcome: 'evaded' },
    })
  })

  it('Trong Phan owned: a dodged hit queues trong_phan_kich instead', () => {
    const { battle, enemyP, defenderP } = makePhanWorld()
    const evadeMods = {
      observationGainBonus: 0,
      phanKinhArmorPierce: 0,
      interceptWardRatio: 0,
      evadeCounterMultiplierBonus: 0.6,
      danTheBonus: 0,
    }
    const w = world(() => [defenderP, enemyP], bakedKitRegistry(evadeMods))
    // Re-seed the defender's markers + payloads against the baked registry.
    withMarker(w, defenderP, 'phan_mon', 'counterChance', 1, 100)
    defenderP.thamTargetId = 'enemy'
    defenderP.reactivePayloads = buildTheTuAnKit(evadeMods).reactivePayloads
    defenderP.entity.baseStats = asBaseStats({ ...defenderP.entity.baseStats, evasionRate: 1_000_000 })
    defenderP.entity.stats = { ...defenderP.entity.stats, evasionRate: 1_000_000 }
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.999).mockReturnValue(0)

    systemOf(w).applyActionImpact(battle, declaredAction('enemy', BASIC, [defenderP], battle.players))

    expect(battle.queuedFollowUps![0]!.payloadSkillId).toBe('trong_phan_kich')
  })

  it('an unobserved attacker opens no Phan window', () => {
    const { battle, defenderP, w } = makePhanWorld()
    defenderP.thamTargetId = undefined
    vi.spyOn(Math, 'random').mockReturnValue(0)

    systemOf(w).applyActionImpact(battle, declaredAction('enemy', BASIC, [defenderP], battle.players))

    expect(battle.queuedFollowUps).toBeUndefined()
    expect(defenderP.entity.currentThe).toBe(100)
  })

  it('hard CC on the defender closes the window', () => {
    const { battle, defenderP, w } = makePhanWorld()
    w.runtime.applyBuff('dong_bang', defenderP)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    systemOf(w).applyActionImpact(battle, declaredAction('enemy', BASIC, [defenderP], battle.players))

    expect(battle.queuedFollowUps).toBeUndefined()
    expect(defenderP.entity.currentThe).toBe(100)
  })

  it('the committed counter drops when its captured target dies before resolution — no refund', () => {
    const { battle, enemyP, defenderP, w } = makePhanWorld()
    const system = systemOf(w)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    // Enemy alive at commit: window pays, +1 debt, queues the counter.
    system.applyActionImpact(battle, declaredAction('enemy', BASIC, [defenderP], battle.players))
    expect(battle.queuedFollowUps).toHaveLength(1)
    expect(defenderP.entity.currentThe).toBe(100 - THE_PROC_COST)

    // The attacker dies BEFORE the queued payload resolves — the dead
    // captured target filters out; payment + debt stand (no refund).
    enemyP.entity.alive = false
    enemyP.alive = false
    system.resolveNextStep(battle)

    expect(battle.queuedFollowUps ?? []).toHaveLength(0)
    expect(defenderP.entity.currentThe).toBe(100 - THE_PROC_COST)
    expect(defenderP.reactionDebt).toBe(1)
  })

  it('a reactive enemy action opens no Phan window (INV-9)', () => {
    const { battle, defenderP, w } = makePhanWorld()
    vi.spyOn(Math, 'random').mockReturnValue(0)

    systemOf(w).applyActionImpact(
      battle,
      declaredAction('enemy', BASIC, [defenderP], battle.players, 'counter'),
    )

    expect(battle.queuedFollowUps).toBeUndefined()
    expect(defenderP.entity.currentThe).toBe(100)
  })

  it('a multi-hit action opens ONE window per reactor — not per hit', () => {
    const { battle, defenderP, w } = makePhanWorld()
    const multiHit: TurnSkillDefinition = {
      ...BASIC,
      id: 'multi_hit',
      instances: { count: 3 },
    }
    vi.spyOn(Math, 'random').mockReturnValue(0)

    systemOf(w).applyActionImpact(battle, declaredAction('enemy', multiHit, [defenderP], battle.players))

    const counters = (battle.queuedFollowUps ?? []).filter(
      (entry) => entry.actorId === 'defender' && entry.actionSource === 'counter',
    )
    expect(counters).toHaveLength(1)
    expect(defenderP.reactionDebt).toBe(1)
  })

  it('a NON-DAMAGING enemy cast resolving on the defender still opens the window (outcome taken)', () => {
    const { battle, defenderP, w } = makePhanWorld()
    const mark: TurnSkillDefinition = {
      id: 'enemy_mark',
      cooldownTurns: 0,
      targeting: { shape: 'single' },
      appliesAilments: [{ buffDefinitionId: 'chan_an', chance: 1 }],
    }
    vi.spyOn(Math, 'random').mockReturnValue(0)

    systemOf(w).applyActionImpact(battle, declaredAction('enemy', mark, [defenderP], battle.players))

    expect(battle.queuedFollowUps).toHaveLength(1)
    expect(battle.queuedFollowUps![0]!.payloadSkillId).toBe('phan_kich')
  })
})

describe('Tro ally-action window (Ung The beta)', () => {
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
    const w = world(() => [...battle.players, ...battle.enemies])
    return { battle, attackerP, supporterP, enemyP, w }
  }

  function withTro(w: World, p: TurnBattleParticipant, chance: number, currentThe: number, observeId = 'enemy') {
    withMarker(w, p, 'tro_mon', 'followUpChance', chance, currentThe)
    p.thamTargetId = observeId
    return p
  }

  it('an ally\'s landed action queues tro_kich on the supporter vs the canonical target', () => {
    const { battle, supporterP, enemyP, w } = makeParty()
    withTro(w, supporterP, 1, 100)
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
    expect(supporterP.entity.currentThe).toBe(100 - THE_PROC_COST)
    expect(supporterP.reactionDebt).toBe(1)
  })

  it('ally AoE queues ONE tro_kich at the canonical target (first landed observed)', () => {
    const { battle, supporterP, enemyP, w } = makeParty()
    const enemy2 = createCombatant({ id: 'enemy2', currentHp: 100_000, maxHp: 100_000 })
    const enemy2P = makeParticipant('enemy2', enemy2, 3, 101)
    battle.enemies.push(enemy2P)
    withTro(w, supporterP, 1, 100)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const aoe: TurnSkillDefinition = { ...BASIC, id: 'aoe', targeting: { shape: 'all_lanes' } }
    systemOf(w).applyActionImpact(battle, declaredAction('attacker', aoe, [enemyP, enemy2P], battle.enemies))

    expect(battle.queuedFollowUps).toHaveLength(1)
    expect(battle.queuedFollowUps![0]!.targetIds).toEqual(['enemy'])
  })

  it('canonical target falls to the next landed entry when the first is dead or unobserved', () => {
    const { battle, attackerP, supporterP, enemyP, w } = makeParty()
    const enemy2 = createCombatant({ id: 'enemy2', currentHp: 100_000, maxHp: 100_000 })
    const enemy2P = makeParticipant('enemy2', enemy2, 3, 101)
    battle.enemies.push(enemy2P)
    // Supporter observes ONLY enemy2 (a recast moved the mark); the
    // first landed entry is unobserved -> canonical falls through.
    withTro(w, supporterP, 1, 100, 'enemy2')
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const aoe: TurnSkillDefinition = { ...BASIC, id: 'aoe', targeting: { shape: 'all_lanes' } }
    systemOf(w).applyActionImpact(battle, declaredAction('attacker', aoe, [enemyP, enemy2P], battle.enemies))

    expect(battle.queuedFollowUps![0]!.targetIds).toEqual(['enemy2'])
    void attackerP
    void enemyP
  })

  it('a whiffed ally action still opens the window — the canonical target is observed + affected', () => {
    const { battle, supporterP, enemyP, w } = makeParty()
    enemyP.entity.baseStats = asBaseStats({ ...enemyP.entity.baseStats, evasionRate: 1_000_000 })
    enemyP.entity.stats = { ...enemyP.entity.stats, evasionRate: 1_000_000 }
    withTro(w, supporterP, 1, 100)
    // One shared stream: 0.999 whiffs the ally's hit, 0 succeeds Tro.
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.999).mockReturnValue(0)

    systemOf(w).applyActionImpact(battle, declaredAction('attacker', BASIC, [enemyP], battle.enemies))

    expect(battle.queuedFollowUps).toHaveLength(1)
    expect(battle.queuedFollowUps![0]!.targetIds).toEqual(['enemy'])
  })

  it('no window when the canonical target is unobserved by that ally', () => {
    const { battle, supporterP, enemyP, w } = makeParty()
    withMarker(w, supporterP, 'tro_mon', 'followUpChance', 1, 100) // no observation
    vi.spyOn(Math, 'random').mockReturnValue(0)

    systemOf(w).applyActionImpact(battle, declaredAction('attacker', BASIC, [enemyP], battle.enemies))

    expect(battle.queuedFollowUps).toBeUndefined()
    expect(supporterP.entity.currentThe).toBe(100)
  })

  it('never triggers on the actor\'s own action — a tro_mon holder acting queues nothing', () => {
    const { battle, attackerP, supporterP, enemyP, w } = makeParty()
    // The ATTACKER carries the marker; only the supporter is other-side.
    withTro(w, attackerP, 1, 100)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    systemOf(w).applyActionImpact(battle, declaredAction('attacker', BASIC, [enemyP], battle.enemies))

    expect(battle.queuedFollowUps).toBeUndefined()
    expect(attackerP.entity.currentThe).toBe(100)
    expect(supporterP.entity.currentThe).toBeUndefined()
  })

  it('a non-damaging authored ally action opens no window', () => {
    const { battle, supporterP, enemyP, w } = makeParty()
    withTro(w, supporterP, 1, 100)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const cheer: TurnSkillDefinition = {
      id: 'cheer',
      cooldownTurns: 0,
      targeting: { shape: 'single' },
      appliesAilments: [{ buffDefinitionId: 'chan_an', chance: 1 }],
    }
    const declared = declaredAction('attacker', cheer, [enemyP], battle.enemies)
    declared.scaledDamage = null

    systemOf(w).applyActionImpact(battle, declared)

    expect(battle.queuedFollowUps).toBeUndefined()
    expect(supporterP.entity.currentThe).toBe(100)
    void enemyP
  })

  it('reactive actions never open the window (INV-9) — a counter payload triggers no Tro', () => {
    const { battle, supporterP, enemyP, w } = makeParty()
    withTro(w, supporterP, 1, 100)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const counterAction = declaredAction('attacker', BASIC, [enemyP], battle.enemies, 'counter')
    systemOf(w).applyActionImpact(battle, counterAction)

    expect(battle.queuedFollowUps).toBeUndefined()
    expect(supporterP.entity.currentThe).toBe(100)
  })

  it('a failed Tro roll pays nothing and commits no debt', () => {
    const { battle, supporterP, enemyP, w } = makeParty()
    withTro(w, supporterP, 0.5, 100)
    vi.spyOn(Math, 'random').mockReturnValue(0.999)

    systemOf(w).applyActionImpact(battle, declaredAction('attacker', BASIC, [enemyP], battle.enemies))

    expect(battle.queuedFollowUps).toBeUndefined()
    expect(supporterP.entity.currentThe).toBe(100)
    expect(supporterP.reactionDebt ?? 0).toBe(0)
  })
})
