import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { TurnBuffDefinition, TurnBuffRegistry } from './TurnBuffTypes'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import { TurnBuffPool } from './TurnBuffPool'
import { TurnBuffSystem } from './TurnBuffSystem'

const STUN_DEF: TurnBuffDefinition = {
  id: 'stun', name: 'Stun', polarity: 'debuff', duration: 10, stackMode: 'refresh',
  effects: [{ type: 'cc', ccEffect: 'stun' }],
}

class Registry implements TurnBuffRegistry {
  private readonly defs = new Map<string, TurnBuffDefinition>()
  constructor(defs: TurnBuffDefinition[]) { for (const d of defs) this.defs.set(d.id, d) }
  get(id: string): TurnBuffDefinition {
    const d = this.defs.get(id)
    if (!d) throw new Error(`missing buff: ${id}`)
    return d
  }
}

function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0 }
  return {
    id: 'id', name: 'name', type: 'enemy', baseStats: stats, stats,
    currentHp: stats.maxHp, maxHp: stats.maxHp, currentMp: stats.maxMp,
    currentSwordIntent: 0, currentMomentum: 0, currentHoaThe: 0, currentThoThe: 0, currentKimThe: 0,
    timeSinceLastBleedProc: 0, tuLucActive: false, tuLucElapsed: 0, tuLucDamageTakenPercent: 0,
    currentWard: 0, timeSinceLastHitTaken: Infinity, realmIndex: 0, x: 0, row: 2, alive: true,
    ...overrides,
  } as CombatEntity
}

describe('TurnBattleSystem — charging actor is immune to the CC counter side-effect', () => {
  it('consecutiveHardCcTurns stays 0 across charging+stunned turns (no premature Bá Thể clear)', () => {
    const player = createCombatant({
      id: 'player', type: 'player', row: 4,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, speed: 100, attack: 100 },
    })
    const enemyEntity = createCombatant({ id: 'enemy', currentHp: 1_000_000, maxHp: 1_000_000 })

    const registry = new Registry([STUN_DEF])
    const buffs = new TurnBuffPool()
    new TurnBuffSystem(buffs).apply(STUN_DEF, player, player, registry)

    const playerParticipant: TurnBattleParticipant = {
      id: 'player', entity: player, speed: 100, priority: 0, actionGauge: 0, alive: true,
      buffs, consecutiveHardCcTurns: 0,
      chargingTurnsRemaining: 3,
      pendingChargedSkillId: 'player_special',
      special: { skill: { id: 'player_special', cooldownTurns: 0, chargeTurns: 3, damage: { kind: 'physical', multiplier: 5 }, targeting: { shape: 'single' } }, remainingCooldownTurns: 0 },
      basic: { id: 'player_basic', cooldownTurns: 0, damage: { kind: 'physical', multiplier: 1 }, targeting: { shape: 'single' } },
    }
    const enemyParticipant: TurnBattleParticipant = {
      id: 'enemy', entity: enemyEntity, speed: 100, priority: 1, actionGauge: 0, alive: true,
      buffs: new TurnBuffPool(), consecutiveHardCcTurns: 0,
      basic: { id: 'enemy_basic', cooldownTurns: 0, damage: { kind: 'physical', multiplier: 1 }, targeting: { shape: 'single' } },
    }

    const battle: TurnBattle = { players: [playerParticipant], enemies: [enemyParticipant], state: 'fighting' }
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000, registry)

    for (let turn = 0; turn < 2; turn += 1) {
      const declared = system.declareActorAction(battle, playerParticipant)

      expect(declared.ccBlocked).toBe(false)
      expect(declared.isCharging).toBe(true)
      expect(playerParticipant.consecutiveHardCcTurns).toBe(0)
    }
  })
})
