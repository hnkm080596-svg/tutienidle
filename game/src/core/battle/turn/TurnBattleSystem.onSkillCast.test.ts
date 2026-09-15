import { describe, expect, it, vi } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { BuffDefinition, BuffDefinitionCatalog } from '../../buff/BuffTypes'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import { BuffPool } from '../../buff/BuffPool'
import { BuffSystem } from '../../buff/BuffSystem'

// 9.5 #9 — cast counting revived on the turn engine. The engine fires
// onSkillCast(actor, skillId) once per COMMITTED action (same point as
// commitAction): normal casts and charge-initiation count; charge
// ticks/resolution and CC-blocked turns do not. The engine is generic —
// it reports every actor's cast; consumers (GameManagerTurnBattleOps)
// filter to the primary player.

const STUN_DEF: BuffDefinition = {
  id: 'stun', name: 'Stun', polarity: 'debuff', duration: 10, stackMode: 'refresh',
  effects: [{ type: 'cc', ccEffect: 'stun' }],
}

class Registry implements BuffDefinitionCatalog {
  private readonly defs = new Map<string, BuffDefinition>()
  constructor(defs: BuffDefinition[]) { for (const d of defs) this.defs.set(d.id, d) }
  get(id: string): BuffDefinition {
    const d = this.defs.get(id)
    if (!d) throw new Error(`missing buff: ${id}`)
    return d
  }
}

function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0 })
  return {
    id: 'id', name: 'name', type: 'enemy', baseStats: stats, stats,
    currentHp: stats.maxHp, maxHp: stats.maxHp, currentMp: stats.maxMp,
    currentSwordIntent: 0, currentMomentum: 0, currentHoaThe: 0, currentThoThe: 0, currentKimThe: 0,
    timeSinceLastBleedProc: 0, tuLucActive: false, tuLucElapsed: 0, tuLucDamageTakenPercent: 0,
    currentWard: 0, turnsSinceLastHitLanded: Infinity, realmIndex: 0, x: 0, row: 2, alive: true,
    ...overrides,
  } as CombatEntity
}

function makeParticipant(
  id: string,
  combatEntity: CombatEntity,
  speed: number,
  priority: number,
): TurnBattleParticipant {
  return {
    id, entity: combatEntity, speed, priority, actionGauge: 0,
    alive: combatEntity.alive, buffs: new BuffPool(), consecutiveHardCcTurns: 0,
    basic: { id: `${id}_basic`, cooldownTurns: 0, damage: { kind: 'physical', multiplier: 1 }, targeting: { shape: 'single' } },
  }
}

function fixture() {
  const player = createCombatant({
    id: 'player', type: 'player', row: 4,
    stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, speed: 100, might: 10 }),
  })
  const enemyEntity = createCombatant({ id: 'enemy', currentHp: 1_000_000, maxHp: 1_000_000 })

  const playerParticipant = makeParticipant('player', player, 100, 0)
  const enemyParticipant = makeParticipant('enemy', enemyEntity, 50, 1)

  const battle: TurnBattle = {
    players: [playerParticipant],
    enemies: [enemyParticipant],
    state: 'fighting',
  }

  return { battle, playerParticipant, enemyParticipant }
}

describe('TurnBattleSystem.onSkillCast — committed-cast callback', () => {
  it('đòn thường bắn callback ĐÚNG 1 lần với (actor, skillId)', () => {
    const { battle, playerParticipant } = fixture()
    const onSkillCast = vi.fn()
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000, undefined, undefined, undefined, undefined, onSkillCast)

    const declared = system.declareActorAction(battle, playerParticipant)
    system.applyActionImpact(battle, declared)

    expect(onSkillCast).toHaveBeenCalledTimes(1)
    expect(onSkillCast).toHaveBeenCalledWith(playerParticipant, 'player_basic')
  })

  it('engine generic: cast của enemy cũng bắn (consumer tự lọc player)', () => {
    const { battle, enemyParticipant } = fixture()
    const onSkillCast = vi.fn()
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000, undefined, undefined, undefined, undefined, onSkillCast)

    const declared = system.declareActorAction(battle, enemyParticipant)
    system.applyActionImpact(battle, declared)

    expect(onSkillCast).toHaveBeenCalledTimes(1)
    expect(onSkillCast).toHaveBeenCalledWith(enemyParticipant, 'enemy_basic')
  })

  it('CC-blocked (stun) → KHÔNG bắn (cast không xảy ra)', () => {
    const { battle, playerParticipant } = fixture()
    const registry = new Registry([STUN_DEF])
    new BuffSystem(playerParticipant.buffs).apply(STUN_DEF, playerParticipant.entity, playerParticipant.entity, registry)

    const onSkillCast = vi.fn()
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000, registry, undefined, undefined, undefined, onSkillCast)

    const declared = system.declareActorAction(battle, playerParticipant)
    expect(declared.ccBlocked).toBe(true)

    system.applyActionImpact(battle, declared)

    expect(onSkillCast).not.toHaveBeenCalled()
  })

  it('marker reaction_path KHÔNG có pool → placeholder cast, KHÔNG bắn', () => {
    const { battle, playerParticipant } = fixture()
    playerParticipant.special = {
      skill: {
        id: 'reaction_marker',
        cooldownTurns: 5,
        compositePicks: { poolType: 'reaction_path', count: 2 },
        targeting: { shape: 'single' },
      },
      remainingCooldownTurns: 0,
    }

    const onSkillCast = vi.fn()
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000, undefined, undefined, undefined, undefined, onSkillCast)

    const declared = system.declareActorAction(battle, playerParticipant)
    expect(declared.markerNoPool).toBe(true)

    system.applyActionImpact(battle, declared)

    expect(onSkillCast).not.toHaveBeenCalled()
    expect(playerParticipant.special.remainingCooldownTurns).toBe(0)
  })

  it('charge-initiation tính 1 cast + commit cooldownTurns; tick/resolve KHÔNG bắn lại', () => {
    const { battle, playerParticipant } = fixture()
    playerParticipant.special = {
      skill: {
        id: 'fixture_charge',
        cooldownTurns: 5,
        chargeTurns: 2,
        damage: { kind: 'physical', multiplier: 6 },
        targeting: { shape: 'single' },
      },
      remainingCooldownTurns: 0,
    }

    const onSkillCast = vi.fn()
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000, undefined, undefined, undefined, undefined, onSkillCast)

    // Lượt 1: charge-init — cast commits (cooldown + resource), callback fires.
    const initDeclared = system.declareActorAction(battle, playerParticipant)
    expect(initDeclared.skillId).toBe('fixture_charge')
    system.applyActionImpact(battle, initDeclared)

    expect(onSkillCast).toHaveBeenCalledTimes(1)
    expect(onSkillCast).toHaveBeenCalledWith(playerParticipant, 'fixture_charge')
    expect(playerParticipant.special.remainingCooldownTurns).toBe(5)

    // Lượt 2: charge tick — không cast mới.
    const tickDeclared = system.declareActorAction(battle, playerParticipant)
    expect(tickDeclared.isCharging).toBe(true)
    system.applyActionImpact(battle, tickDeclared)
    expect(onSkillCast).toHaveBeenCalledTimes(1)

    // Lượt 3: charge-resolve — hit lands, nhưng cast đã tính ở initiation.
    const resolveDeclared = system.declareActorAction(battle, playerParticipant)
    expect(resolveDeclared.chargeResolved).toBe(true)
    system.applyActionImpact(battle, resolveDeclared)
    expect(onSkillCast).toHaveBeenCalledTimes(1)
  })

  it('self-target skill (affected=[actor]) vẫn bắn đúng 1 lần', () => {
    const { battle, playerParticipant } = fixture()
    playerParticipant.special = {
      skill: {
        id: 'self_buff',
        cooldownTurns: 3,
        targetScope: 'self',
        targeting: { shape: 'single' },
      },
      remainingCooldownTurns: 0,
    }

    const onSkillCast = vi.fn()
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000, undefined, undefined, undefined, undefined, onSkillCast)

    const declared = system.declareActorAction(battle, playerParticipant)
    system.applyActionImpact(battle, declared)

    expect(onSkillCast).toHaveBeenCalledTimes(1)
    expect(onSkillCast).toHaveBeenCalledWith(playerParticipant, 'self_buff')
  })
})
