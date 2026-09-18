import { describe, expect, it, vi, afterEach } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { asBaseStats, createBaseStats } from '../../stats/StatBlock'
import { BUFF_REGISTRY } from '../../../data/buff/BuffRegistry'
import { GENERIC_PHYSICAL_BASIC } from '../../../data/skill/TurnBasicAttacks'
import { makeTurnRuntime } from './testing/TurnRuntimeFixtures'

// ARCH-009 (M9) — buff identity repair, driven through the REAL
// TurnBattleSystem + BUFF_REGISTRY (no helper-only shortcuts):
//
//  - ON_HIT_POOL (AUD-C04): an onHitProc buff held by the attacker writes
//    its proc result into the VICTIM's pool with sourceId=attacker and
//    targetId=victim — the holder is never stunned by its own proc.
//  - MULTISOURCE_REACTION (AUD-C08): reaction consumption removes the
//    EXACT matched ingredient instance — a fire DoT applied by the player
//    is consumed once and cannot feed a second reaction triggered by a
//    companion's water hit.
//  - CC_SCOPE: target-scoped cc queries — a cc buff aimed at another
//    entity inside a pool must not control the pool holder.
//  - MULTI_SOURCE_SELECTION: when several sources supply a valid
//    ingredient, the OLDEST applied instance is consumed (pool insertion
//    order — see ElementReaction.ts's consumption contract).

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

function makeParticipant(
  id: string,
  combatEntity: CombatEntity,
  speed: number,
  priority: number,
  basic: TurnBattleParticipant['basic'] = GENERIC_PHYSICAL_BASIC,
): TurnBattleParticipant {
  return {
    id,
    entity: combatEntity,
    speed,
    priority,
    actionGauge: 0,
    alive: combatEntity.alive,
    
    consecutiveHardCcTurns: 0,
    basic,
  }
}

function makeEngine(
  eventBus: EventBus,
  participants: () => readonly TurnBattleParticipant[],
): { system: TurnBattleSystem; combat: CombatSystem; runtime: ReturnType<typeof makeTurnRuntime> } {
  const combat = new CombatSystem(eventBus)
  const runtime = makeTurnRuntime({ registry: BUFF_REGISTRY, participants, combatSystem: combat })
  const system = new TurnBattleSystem(combat, 10_000, BUFF_REGISTRY, undefined, runtime)
  return { system, combat, runtime }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ARCH-009 (M9) — on-hit proc writes to the VICTIM pool (AUD-C04)', () => {
  it('thach_hoa holder lands a hit: choang lands in the victim pool with source=hitter, target=victim; holder is never stunned', () => {
    const eventBus = new EventBus()

    const playerEntity = createCombatant({ id: 'player', type: 'player' })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 0 }),
    })

    const player = makeParticipant('player', playerEntity, 10, 0)
    const enemy = makeParticipant('enemy', enemyEntity, 10, 1)
    const participants = [player, enemy]
    const { system, runtime } = makeEngine(eventBus, () => participants)

    // The ENEMY debuffed the player with thach_hoa on an earlier turn --
    // the proc grant lives on the HOLDER (player) instance.
    runtime.applyBuff('thach_hoa', player, enemy)

    const battle: TurnBattle = { players: [player], enemies: [enemy], state: 'fighting' }

    // Fixed RNG: 0.2 < thach_hoa proc chance 0.5 (fires), lands vs
    // evasion 0, no crit (criticalRate 0).
    vi.spyOn(Math, 'random').mockReturnValue(0.2)

    system.resolveActorTurn(battle, player)

    // The proc result belongs to the VICTIM (enemy) read -- and carries
    // the identity of the hit that triggered it, not the thach_hoa caster.
    const enemyBuffs = runtime.buffs.getForTarget(enemy.entity.id)
    const choang = enemyBuffs.find((i) => i.definitionId === 'choang' && i.sourceId === 'player')
    expect(choang).toMatchObject({ sourceId: 'player', targetId: 'enemy' })
    expect(runtime.buffs.hasControl(enemy.entity.id, 'stun')).toBe(true)

    // The holder read is untouched by the proc result and the holder is
    // NOT stunned (old bug left choang in the holder pool and stunned it).
    const playerBuffs = runtime.buffs.getForTarget(player.entity.id)
    expect(playerBuffs.some((i) => i.definitionId === 'choang')).toBe(false)
    expect(playerBuffs.some((i) => i.definitionId === 'thach_hoa')).toBe(true)
    expect(runtime.buffs.hasControl(player.entity.id, 'stun')).toBe(false)

    // Engine-level consequence: the stunned victim's next declare is
    // ccBlocked through the real CC gate.
    const enemyStep = system.resolveActorTurn(battle, enemy)
    expect(enemyStep.ccBlocked).toBe(true)
  })

  // DECISION RECORD (Mission C, 2026-09-16 audit T3-19): `onHitProc` =
  // holder-attacks -> victim-applies is the AUTHORED contract
  // (docs/systems/buffs.md:18; LegacyBuffs.ts:225-228 marks the port
  // "dung brief"). `thach_hoa` on an enemy intentionally lets that
  // enemy's hits stun the player. The audit claim is recorded as STALE —
  // do not flip the data. If a future design wants struck-direction
  // semantics, the mechanism is a NEW `onStruckProc` effect type, not a
  // data flip.
  it('thach_hoa on the ENEMY (authored direction): the enemy landing a hit stuns the player, not itself', () => {
    const eventBus = new EventBus()

    const playerEntity = createCombatant({
      id: 'player',
      type: 'player',
      stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 0 }),
    })
    const enemyEntity = createCombatant({ id: 'enemy', currentHp: 1_000_000 })

    const player = makeParticipant('player', playerEntity, 10, 0)
    const enemy = makeParticipant('enemy', enemyEntity, 10, 1)
    const participants = [player, enemy]
    const { system, runtime } = makeEngine(eventBus, () => participants)

    // Authored direction: tho_cau_thuat puts thach_hoa on the TARGET, so
    // the enemy holds it and its hits can stun the player.
    runtime.applyBuff('thach_hoa', enemy, player)

    const battle: TurnBattle = { players: [player], enemies: [enemy], state: 'fighting' }

    vi.spyOn(Math, 'random').mockReturnValue(0.2)

    system.resolveActorTurn(battle, enemy)

    const playerBuffs = runtime.buffs.getForTarget(player.entity.id)
    const choang = playerBuffs.find((i) => i.definitionId === 'choang' && i.sourceId === 'enemy')
    expect(choang).toMatchObject({ sourceId: 'enemy', targetId: 'player' })
    expect(runtime.buffs.hasControl(player.entity.id, 'stun')).toBe(true)
    expect(runtime.buffs.getForTarget(enemy.entity.id).some((i) => i.definitionId === 'choang')).toBe(false)
    expect(runtime.buffs.hasControl(enemy.entity.id, 'stun')).toBe(false)

    const playerStep = system.resolveActorTurn(battle, player)
    expect(playerStep.ccBlocked).toBe(true)
  })
})

describe('ARCH-009 (M9) — target-scoped CC queries', () => {
  it('a cc instance aimed at a DIFFERENT entity does not block the actor (ccBlocked stays false)', () => {
    const eventBus = new EventBus()

    const playerEntity = createCombatant({ id: 'player', type: 'player' })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 0 }),
    })

    const player = makeParticipant('player', playerEntity, 10, 0)
    const enemy = makeParticipant('enemy', enemyEntity, 10, 1)
    const participants = [player, enemy]
    const { system, runtime } = makeEngine(eventBus, () => participants)

    // Foreign-target instance: a stun whose targetId is the enemy. buff2
    // reads are target-scoped -- the instance cannot control the player
    // even though it lives in the same store.
    runtime.applyBuff('choang', enemy, enemy)

    const battle: TurnBattle = { players: [player], enemies: [enemy], state: 'fighting' }

    vi.spyOn(Math, 'random').mockReturnValue(0.2)

    const step = system.resolveActorTurn(battle, player)

    expect(runtime.buffs.hasControl(player.entity.id, 'stun')).toBe(false)
    expect(step.ccBlocked).toBe(false)
    expect(step.targetIds).toContain('enemy')
    expect(enemyEntity.currentHp).toBeLessThan(enemyEntity.maxHp)
  })
})
