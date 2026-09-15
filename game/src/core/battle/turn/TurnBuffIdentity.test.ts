import { describe, expect, it, vi, afterEach } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import { TurnReactionManager } from './TurnReactionManager'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { asBaseStats, createBaseStats } from '../../stats/StatBlock'
import { BuffPool } from '../../buff/BuffPool'
import { BuffSystem } from '../../buff/BuffSystem'
import { BUFF_REGISTRY } from '../../../data/buff/BuffRegistry'
import { GENERIC_PHYSICAL_BASIC, PHAP_TU_BASICS } from '../../../data/skill/TurnBasicAttacks'
import type { Buff } from '../../buff/BuffTypes'

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
    buffs: new BuffPool(),
    consecutiveHardCcTurns: 0,
    basic,
  }
}

function makeEngine(eventBus: EventBus): { system: TurnBattleSystem; combat: CombatSystem } {
  const combat = new CombatSystem(eventBus)
  const system = new TurnBattleSystem(
    combat,
    10_000,
    BUFF_REGISTRY,
    undefined,
    new TurnReactionManager(eventBus),
  )
  return { system, combat }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ARCH-009 (M9) — on-hit proc writes to the VICTIM pool (AUD-C04)', () => {
  it('thach_hoa holder lands a hit: choang lands in the victim pool with source=hitter, target=victim; holder is never stunned', () => {
    const eventBus = new EventBus()
    const { system } = makeEngine(eventBus)

    const playerEntity = createCombatant({ id: 'player', type: 'player' })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 0 }),
    })

    const player = makeParticipant('player', playerEntity, 10, 0)
    const enemy = makeParticipant('enemy', enemyEntity, 10, 1)

    // The ENEMY debuffed the player with thach_hoa on an earlier turn —
    // the proc definition lives in the HOLDER (player) pool.
    new BuffSystem(player.buffs).apply(BUFF_REGISTRY.get('thach_hoa'), enemyEntity, playerEntity, BUFF_REGISTRY)

    const battle: TurnBattle = { players: [player], enemies: [enemy], state: 'fighting' }

    // Fixed RNG: 0.2 < thach_hoa proc chance 0.5 (fires), lands vs
    // evasion 0, no crit (criticalRate 0).
    vi.spyOn(Math, 'random').mockReturnValue(0.2)

    system.resolveActorTurn(battle, player)

    // The proc result belongs to the VICTIM (enemy) pool — and carries
    // the identity of the hit that triggered it, not the thach_hoa caster.
    const choang = enemy.buffs.getFromSource('choang', 'player')
    expect(choang).toMatchObject({ sourceId: 'player', targetId: 'enemy' })
    expect(new BuffSystem(enemy.buffs).isStunned('enemy')).toBe(true)

    // The holder pool is untouched by the proc result and the holder is
    // NOT stunned (old bug left choang in the holder pool and stunned it).
    expect(player.buffs.hasAny('choang')).toBe(false)
    expect(player.buffs.hasAny('thach_hoa')).toBe(true)
    expect(new BuffSystem(player.buffs).isStunned('player')).toBe(false)

    // Engine-level consequence: the stunned victim's next declare is
    // ccBlocked through the real CC gate.
    const enemyStep = system.resolveActorTurn(battle, enemy)
    expect(enemyStep.ccBlocked).toBe(true)
  })

  it('thach_hoa on the ENEMY (authored direction): the enemy landing a hit stuns the player, not itself', () => {
    const eventBus = new EventBus()
    const { system } = makeEngine(eventBus)

    const playerEntity = createCombatant({
      id: 'player',
      type: 'player',
      stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 0 }),
    })
    const enemyEntity = createCombatant({ id: 'enemy', currentHp: 1_000_000 })

    const player = makeParticipant('player', playerEntity, 10, 0)
    const enemy = makeParticipant('enemy', enemyEntity, 10, 1)

    // Authored direction: tho_cau_thuat puts thach_hoa on the TARGET, so
    // the enemy holds it and its hits can stun the player.
    new BuffSystem(enemy.buffs).apply(BUFF_REGISTRY.get('thach_hoa'), playerEntity, enemyEntity, BUFF_REGISTRY)

    const battle: TurnBattle = { players: [player], enemies: [enemy], state: 'fighting' }

    vi.spyOn(Math, 'random').mockReturnValue(0.2)

    system.resolveActorTurn(battle, enemy)

    const choang = player.buffs.getFromSource('choang', 'enemy')
    expect(choang).toMatchObject({ sourceId: 'enemy', targetId: 'player' })
    expect(new BuffSystem(player.buffs).isStunned('player')).toBe(true)
    expect(enemy.buffs.hasAny('choang')).toBe(false)
    expect(new BuffSystem(enemy.buffs).isStunned('enemy')).toBe(false)

    const playerStep = system.resolveActorTurn(battle, player)
    expect(playerStep.ccBlocked).toBe(true)
  })
})

describe('ARCH-009 (M9) — target-scoped CC queries', () => {
  it('a cc buff aimed at a DIFFERENT entity inside the actor pool does not block that actor (ccBlocked stays false)', () => {
    const eventBus = new EventBus()
    const { system } = makeEngine(eventBus)

    const playerEntity = createCombatant({ id: 'player', type: 'player' })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 0 }),
    })

    const player = makeParticipant('player', playerEntity, 10, 0)
    const enemy = makeParticipant('enemy', enemyEntity, 10, 1)

    // Misrouted/foreign instance: a stun sitting in the PLAYER pool whose
    // targetId points at the enemy. The old unscoped isStunned() counted
    // it and ccBlocked the player; the query is now target-scoped.
    const foreignStun: Buff = {
      id: 'foreign_stun',
      sourceId: 'enemy',
      targetId: 'enemy',
      polarity: 'debuff',
      duration: 5,
      remainingTurns: 5,
      stacks: 1,
      stackMode: 'refresh',
      effects: [{ type: 'cc', ccEffect: 'stun' }],
    }
    player.buffs.add(foreignStun)

    const battle: TurnBattle = { players: [player], enemies: [enemy], state: 'fighting' }

    vi.spyOn(Math, 'random').mockReturnValue(0.2)

    const step = system.resolveActorTurn(battle, player)

    expect(step.ccBlocked).toBe(false)
    expect(step.targetIds).toContain('enemy')
    expect(enemyEntity.currentHp).toBeLessThan(enemyEntity.maxHp)
  })
})

describe('ARCH-009 (M9) — reaction consumes the exact matched ingredient instances (AUD-C08)', () => {
  it('engine path: flagged player + companion water — companion cannot initiate, player water consumes bong exactly once', () => {
    const eventBus = new EventBus()
    const { system } = makeEngine(eventBus)

    const playerEntity = createCombatant({ id: 'player', type: 'player' })
    const companionEntity = createCombatant({ id: 'companion', type: 'player' })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 0 }),
    })

    // Review fix (MED-3): reaction initiation is the phap_tu-domain
    // capability flag. The player's fixture carries it (adapter stamps
    // it from CULTIVATION_PATH_STAT_DOMAINS); the companion does not.
    const player = makeParticipant('player', playerEntity, 10, 0, PHAP_TU_BASICS.fire)
    player.canInitiateWuxingReactions = true
    const companion = makeParticipant('companion', companionEntity, 10, 1, PHAP_TU_BASICS.water)
    const enemy = makeParticipant('enemy', enemyEntity, 10, 2)

    const battle: TurnBattle = {
      players: [player, companion],
      enemies: [enemy],
      state: 'fighting',
    }

    const reactionEvents: unknown[] = []
    eventBus.on('reaction', (event) => reactionEvents.push(event))

    // 0.2 < every ailment chance (fire 0.5, water 0.5) — deterministic
    // application through applySkillAilments -> TurnReactionManager.
    vi.spyOn(Math, 'random').mockReturnValue(0.2)

    // Player lands hoa_cau_thuat: bong (sourceId 'player') on the enemy.
    system.resolveActorTurn(battle, player)
    expect(enemy.buffs.getFromSource('bong', 'player')).toBeDefined()

    // Companion lands thuy_tien_thuat: te_cong applies but CANNOT
    // initiate — player-side membership alone no longer fires Boc Hoi.
    system.resolveActorTurn(battle, companion)
    expect(reactionEvents).toHaveLength(0)
    expect(enemy.buffs.getFromSource('te_cong', 'companion')).toBeDefined()
    expect(enemy.buffs.getFromSource('bong', 'player')).toBeDefined()

    // Player lands a water hit: the flagged newcomer's te_cong pairs
    // with the incumbent bong — Boc Hoi consumes the incumbent bong AND
    // the newcomer instance itself (companion's te_cong, applied first,
    // is not an ingredient of this pair and stays).
    player.basic = PHAP_TU_BASICS.water
    system.resolveActorTurn(battle, player)
    expect(reactionEvents).toHaveLength(1)
    expect(enemy.buffs.getFromSource('bong', 'player')).toBeUndefined()
    expect(enemy.buffs.getFromSource('te_cong', 'player')).toBeUndefined()
    expect(enemy.buffs.getFromSource('te_cong', 'companion')).toBeDefined()

    // Player lands a SECOND water hit: te_cong reapplies but there is
    // no bong left — the old bug replayed the reaction off the player's
    // lingering bong instance.
    system.resolveActorTurn(battle, player)
    expect(reactionEvents).toHaveLength(1)
    expect(enemy.buffs.getFromSource('te_cong', 'player')).toBeDefined()
    expect(new BuffSystem(enemy.buffs).getActiveIds()).toEqual(['te_cong'])
  })

  it('multi-source selection: when two sources supply the same ingredient id, the OLDEST applied instance is consumed', () => {
    const eventBus = new EventBus()
    const reactionManager = new TurnReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const player = createCombatant({ id: 'player', type: 'player' })
    const companion = createCombatant({ id: 'companion', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 100_000, maxHp: 100_000 })

    const targetBuffPool = new BuffPool()
    const targetBuffs = new BuffSystem(targetBuffPool)

    // Player's bong was applied FIRST (oldest), companion's bong second.
    targetBuffs.apply(BUFF_REGISTRY.get('bong'), player, target)
    targetBuffs.apply(BUFF_REGISTRY.get('bong'), companion, target)
    targetBuffs.apply(BUFF_REGISTRY.get('te_cong'), companion, target)

    reactionManager.checkAndTrigger(targetBuffPool, 'te_cong', companion, target, combatSystem, BUFF_REGISTRY)

    // Oldest-first: the PLAYER's instance was consumed; the companion's
    // own bong survives for a later reaction.
    expect(targetBuffPool.getFromSource('bong', 'player')).toBeUndefined()
    expect(targetBuffPool.getFromSource('bong', 'companion')).toBeDefined()
    expect(targetBuffPool.getFromSource('te_cong', 'companion')).toBeUndefined()

    // A second water ingredient consumes the remaining (companion) bong.
    targetBuffs.apply(BUFF_REGISTRY.get('te_cong'), companion, target)
    reactionManager.checkAndTrigger(targetBuffPool, 'te_cong', companion, target, combatSystem, BUFF_REGISTRY)
    expect(targetBuffPool.getFromSource('bong', 'companion')).toBeUndefined()
    expect(targetBuffs.getActiveIds()).toEqual([])
  })

  it('the consumed pair keeps stacking/refresh semantics: re-applied same-source ingredients refresh in place and still react', () => {
    const eventBus = new EventBus()
    const reactionManager = new TurnReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const player = createCombatant({ id: 'player', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 100_000, maxHp: 100_000 })

    const targetBuffPool = new BuffPool()
    const targetBuffs = new BuffSystem(targetBuffPool)

    targetBuffs.apply(BUFF_REGISTRY.get('bong'), player, target)
    targetBuffs.apply(BUFF_REGISTRY.get('bong'), player, target) // refresh, still one instance
    targetBuffs.apply(BUFF_REGISTRY.get('te_cong'), player, target)

    reactionManager.checkAndTrigger(targetBuffPool, 'te_cong', player, target, combatSystem, BUFF_REGISTRY)

    expect(targetBuffs.getActiveIds()).toEqual([])
  })
})
