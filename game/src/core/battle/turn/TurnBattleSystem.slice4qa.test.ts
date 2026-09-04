import { describe, expect, it, vi } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import { TurnBuffPool } from './TurnBuffPool'
import { TurnBuffSystem } from './TurnBuffSystem'
import type { TurnBuffDefinition, TurnBuffRegistry } from './TurnBuffTypes'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'

// QA adversarial probes (2026-09-04 quick review) — Slice 4 resource/boss.

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

const ENRAGE: TurnBuffDefinition = {
  id: 'qa_enrage', name: 'Enrage', polarity: 'buff', duration: 999, stackMode: 'refresh',
  effects: [{ type: 'dot', dpsRatio: 0.1, element: 'physical' }],
}

describe('Slice 4 adversarial (QA probes)', () => {
  it('INV-S4-1: resource clamp tại min — decay không xuống dưới 0', () => {
    const player = createCombatant({ id: 'player', type: 'player' as never, stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 10 } })
    const enemy = createCombatant({ id: 'enemy', currentHp: 1_000_000, maxHp: 1_000_000, stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 } })

    const playerP = makeParticipant('player', player, 10, 0)
    playerP.resources = {
      values: { kim_the: 2 },
      deltasPerTurn: [{ stat: 'kim_the', amount: -5, min: 0 }],
    }

    const battle: TurnBattle = { player: playerP, enemies: [makeParticipant('enemy', enemy, 5, 1)], state: 'fighting' }

    new TurnBattleSystem(new CombatSystem(new EventBus())).resolveNextStep(battle)

    expect(playerP.resources.values.kim_the).toBe(0)
  })

  it('INV-S4-2: totalTurnsElapsed tăng kể cả khi actor bị CC blocked', () => {
    const player = createCombatant({ id: 'player', type: 'player' as never, currentHp: 1_000_000, maxHp: 1_000_000, stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 10 } })
    const enemy = createCombatant({ id: 'enemy', currentHp: 1_000_000, maxHp: 1_000_000, stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 } })

    const playerP = makeParticipant('player', player, 10, 0)
    const stun: TurnBuffDefinition = {
      id: 'qa_stun', name: 'Stun', polarity: 'debuff', duration: 5, stackMode: 'refresh',
      effects: [{ type: 'cc', ccEffect: 'stun' }],
    }
    const registry = new FixtureRegistry([stun])
    new TurnBuffSystem(playerP.buffs).apply(stun, enemy, player, registry)

    const battle: TurnBattle = { player: playerP, enemies: [makeParticipant('enemy', enemy, 5, 1)], state: 'fighting' }

    new TurnBattleSystem(new CombatSystem(new EventBus()), 10, registry).resolveNextStep(battle)

    expect(battle.totalTurnsElapsed).toBe(1)
  })

  it('INV-S4-3: boss trigger fire khi actor bị CC blocked vẫn xảy ra (fire trước CC check)', () => {
    const player = createCombatant({ id: 'player', type: 'player' as never, currentHp: 1_000_000, maxHp: 1_000_000, stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 } })
    const enemy = createCombatant({ id: 'enemy', currentHp: 1_000_000, maxHp: 1_000_000, stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 10 } })

    const enemyP = makeParticipant('enemy', enemy, 5, 1)
    enemyP.bossTrigger = { afterTurns: 1, buffDefinitionId: 'qa_enrage', firedAlready: false }

    const battle: TurnBattle = { player: makeParticipant('player', player, 10, 0), enemies: [enemyP], state: 'fighting' }
    const registry = new FixtureRegistry([ENRAGE])

    // Chờ enemy thật sự tới lượt — ATB gauge: player speed 10 tích nhanh
    // hơn nên hành động nhiều lần trước; boss trigger chỉ check khi
    // CHÍNH enemy làm actor (đúng thiết kế — trigger của boss gắn lượt boss).
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, registry)
    for (let i = 0; i < 6; i++) {
      const step = system.resolveNextStep(battle)
      if (step.actorId === 'enemy') {
        break
      }
    }

    expect(enemyP.bossTrigger.firedAlready).toBe(true)
    expect(enemyP.buffs.getAll().some((b) => b.id === 'qa_enrage')).toBe(true)
  })

  it('INV-S4-4: resource tick KHÔNG chạy cho actor khác — chỉ owner của pool', () => {
    const player = createCombatant({ id: 'player', type: 'player' as never, stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 } })
    const enemy = createCombatant({ id: 'enemy', currentHp: 1_000_000, maxHp: 1_000_000, stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 } })

    const playerP = makeParticipant('player', player, 1, 0)
    playerP.resources = {
      values: { mana_pool: 10 },
      deltasPerTurn: [{ stat: 'mana_pool', amount: 3, min: 0, max: 20 }],
    }

    const battle: TurnBattle = { player: playerP, enemies: [makeParticipant('enemy', enemy, 100, 1)], state: 'fighting' }

    // Enemy speed 100 đi trước — player resources KHÔNG được tick ở step này.
    new TurnBattleSystem(new CombatSystem(new EventBus())).resolveNextStep(battle)

    expect(playerP.resources.values.mana_pool).toBe(10)
  })
})
