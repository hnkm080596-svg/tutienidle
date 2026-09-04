import { describe, expect, it, vi } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import { TurnBuffPool } from './TurnBuffPool'
import { TurnBuffSystem } from './TurnBuffSystem'
import type { TurnBuffDefinition, TurnBuffRegistry } from './TurnBuffTypes'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'

// QA adversarial probes (2026-09-04 quick review) — Slice 3 buff/CC wiring.

function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, blockChance: 0 }

  return {
    id: 'id',
    name: 'name',
    type: 'enemy',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentSwordIntent: 0,
    currentMomentum: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    timeSinceLastBleedProc: 0,
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  } as CombatEntity
}

function makeParticipant(
  id: string,
  combatEntity: CombatEntity,
  speed: number,
  priority: number,
): TurnBattleParticipant {
  return { id, entity: combatEntity, speed, priority, actionGauge: 0, alive: combatEntity.alive, buffs: new TurnBuffPool(), consecutiveHardCcTurns: 0 }
}

class FixtureRegistry implements TurnBuffRegistry {
  private readonly defs = new Map<string, TurnBuffDefinition>()

  constructor(defs: TurnBuffDefinition[]) {
    for (const d of defs) this.defs.set(d.id, d)
  }

  get(id: string): TurnBuffDefinition {
    const d = this.defs.get(id)
    if (!d) throw new Error(`missing fixture: ${id}`)
    return d
  }
}

const STUN: TurnBuffDefinition = {
  id: 'qa_stun', name: 'Stun', polarity: 'debuff', duration: 2, stackMode: 'refresh',
  effects: [{ type: 'cc', ccEffect: 'stun' }],
}

const BURN: TurnBuffDefinition = {
  id: 'qa_burn', name: 'Burn', polarity: 'debuff', duration: 3, stackMode: 'refresh',
  effects: [{ type: 'dot', dpsRatio: 1, element: 'physical' }],
}

describe('Slice 3 adversarial (QA probes)', () => {
  it('INV-S3-1: stun duration-2 block đúng 2 lượt rồi hết (CC check trước tick)', () => {
    const player = createCombatant({ id: 'player', type: 'player' as never, stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 10 } })
    const enemy = createCombatant({ id: 'enemy', currentHp: 1_000_000, maxHp: 1_000_000, stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 } })

    const playerP = makeParticipant('player', player, 10, 0)
    const registry = new FixtureRegistry([STUN])
    new TurnBuffSystem(playerP.buffs).apply(STUN, enemy, player, registry)

    const battle: TurnBattle = {
      player: playerP,
      enemies: [makeParticipant('enemy', enemy, 5, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, registry)

    const step1 = system.resolveNextStep(battle)
    expect(step1.ccBlocked).toBe(true)

    const step2 = system.resolveNextStep(battle)
    expect(step2.ccBlocked).toBe(true)

    // duration 2: sau 2 lượt block, buff expire → lượt 3 hành động được.
    const step3 = system.resolveNextStep(battle)
    expect(step3.ccBlocked).toBe(false)
    expect(step3.targetIds.length).toBeGreaterThan(0)
  })

  it('INV-S3-2: DoT tick tại lượt HOLDER gây damage lên holder (không lên source)', () => {
    const player = createCombatant({ id: 'player', type: 'player' as never, currentHp: 1_000_000, maxHp: 1_000_000, stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 } })
    const enemy = createCombatant({ id: 'enemy', currentHp: 1_000_000, maxHp: 1_000_000, stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 10 } })

    const playerP = makeParticipant('player', player, 10, 0)
    const enemyP = makeParticipant('enemy', enemy, 5, 1)

    const registry = new FixtureRegistry([BURN])
    new TurnBuffSystem(enemyP.buffs).apply(BURN, player, enemy, registry)

    const battle: TurnBattle = { player: playerP, enemies: [enemyP], state: 'fighting' }
    const hpBefore = enemy.currentHp

    new TurnBattleSystem(new CombatSystem(new EventBus()), 10, registry).resolveNextStep(battle)

    // enemy (holder burn) tick buff ở lượt của chính nó → hp giảm.
    expect(enemy.currentHp).toBeLessThan(hpBefore)
    expect(player.currentHp).toBe(hpBefore)
  })

  it('INV-S3-3: buff tick tiếp trên holder đã chết? — resolveNextTurn không chọn dead, buff giữ nguyên', () => {
    const player = createCombatant({ id: 'player', type: 'player' as never, stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 } })
    const dying = createCombatant({ id: 'dying', currentHp: 1, maxHp: 1, stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 } })

    const playerP = makeParticipant('player', player, 10, 0)
    const dyingP = makeParticipant('dying', dying, 5, 1)

    const registry = new FixtureRegistry([BURN])
    new TurnBuffSystem(dyingP.buffs).apply(BURN, player, dying, registry)

    const battle: TurnBattle = { player: playerP, enemies: [dyingP], state: 'fighting' }

    const step = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, registry).resolveNextStep(battle)

    // player giết dying trước; dying không được chọn làm actor nên buff của nó không tick.
    expect(step.state).toBe('victory')
    expect(dyingP.buffs.getAll()).toHaveLength(1)
  })

  it('INV-S3-4: CC blocked vẫn bị DoT của chính buff đó tick (stun không dừng dot pool processing)', () => {
    const player = createCombatant({ id: 'player', type: 'player' as never, currentHp: 1_000_000, maxHp: 1_000_000, stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 } })
    const enemy = createCombatant({ id: 'enemy', currentHp: 1_000_000, maxHp: 1_000_000, stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 } })

    const playerP = makeParticipant('player', player, 10, 0)
    const stunDot: TurnBuffDefinition = {
      id: 'qa_stun_dot', name: 'StunDot', polarity: 'debuff', duration: 2, stackMode: 'refresh',
      effects: [{ type: 'cc', ccEffect: 'stun' }, { type: 'dot', dpsRatio: 1, element: 'physical' }],
    }
    const registry = new FixtureRegistry([stunDot])
    new TurnBuffSystem(playerP.buffs).apply(stunDot, enemy, player, registry)

    const battle: TurnBattle = { player: playerP, enemies: [makeParticipant('enemy', enemy, 5, 1)], state: 'fighting' }
    const hpBefore = player.currentHp

    const step = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, registry).resolveNextStep(battle)

    expect(step.ccBlocked).toBe(true)
    // DoT tick trong update() TRƯỚC step action — hp giảm dù bị block.
    expect(player.currentHp).toBeLessThan(hpBefore)
  })

  it('INV-S3-5: self-buff dot tự gây damage cho chính mình qua TurnBuffSystem (combat mock)', () => {
    const player = createCombatant({ id: 'player', type: 'player' as never, currentHp: 1_000_000, maxHp: 1_000_000, stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 100 } })
    const enemy = createCombatant({ id: 'enemy', currentHp: 1_000_000, maxHp: 1_000_000, stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 } })

    const playerP = makeParticipant('player', player, 10, 0)
    playerP.basic = {
      id: 'qa_self_dot', cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      appliesBuff: { definitionId: 'qa_burn', target: 'self' },
    }

    const registry = new FixtureRegistry([BURN])
    const battle: TurnBattle = { player: playerP, enemies: [makeParticipant('enemy', enemy, 5, 1)], state: 'fighting' }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, registry)
    system.resolveNextStep(battle)

    expect(playerP.buffs.getAll()).toHaveLength(1)
    expect(playerP.buffs.getAll()[0]!.sourceId).toBe('player')
  })
})
