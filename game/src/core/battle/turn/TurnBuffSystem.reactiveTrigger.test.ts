import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { TurnBuffDefinition, TurnBuffRegistry } from './TurnBuffTypes'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import { TurnBuffPool } from './TurnBuffPool'
import { TurnBuffSystem } from './TurnBuffSystem'

// Action Playback Task 5 — reactiveTrigger buff effect:
//   onCastBegin    — roll khi actor bắt đầu cast (punish-on-cast); nếu áp
//                    hard-CC buff, CC-check kế tiếp block turn (ccBlocked)
//   onImpactLanded — roll trên TARGET bị hit (counter); queuesFollowUp
//                    đặt battle.queuedFollowUpActorId (counter-turn)

const STUN_DEF: TurnBuffDefinition = {
  id: 'react_stun',
  name: 'Punish Stun',
  polarity: 'debuff',
  duration: 1,
  stackMode: 'refresh',
  effects: [{ type: 'cc', ccEffect: 'stun' }],
}

const COUNTER_DEF: TurnBuffDefinition = {
  id: 'react_counter',
  name: 'Counter Stance',
  polarity: 'buff',
  duration: 2,
  stackMode: 'refresh',
  effects: [{ type: 'reactiveTrigger', trigger: 'onImpactLanded', chance: 1, queuesFollowUp: true }],
}

const PUNISH_DEF: TurnBuffDefinition = {
  id: 'react_punish',
  name: 'Punish Stance',
  polarity: 'buff',
  duration: 2,
  stackMode: 'refresh',
  effects: [{ type: 'reactiveTrigger', trigger: 'onCastBegin', chance: 1, appliesDefinitionId: 'react_stun' }],
}

class Registry implements TurnBuffRegistry {
  private readonly defs = new Map<string, TurnBuffDefinition>()

  constructor(defs: TurnBuffDefinition[]) {
    for (const d of defs) this.defs.set(d.id, d)
  }

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

function makeParticipant(
  id: string,
  entity: CombatEntity,
  speed: number,
  priority: number,
): TurnBattleParticipant {
  return {
    id, entity, speed, priority, actionGauge: 0, alive: entity.alive,
    buffs: new TurnBuffPool(), consecutiveHardCcTurns: 0,
    basic: { id: `${id}_basic`, cooldownTurns: 0, damage: { kind: 'physical', multiplier: 1 }, targeting: { shape: 'single' } },
  }
}

function fixture(targetBuffs: TurnBuffDefinition[], actorBuffs: TurnBuffDefinition[] = []) {
  const player = createCombatant({
    id: 'player',
    type: 'player',
    row: 4,
    stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, speed: 100, attack: 100 },
  })
  const enemyEntity = createCombatant({
    id: 'enemy',
    currentHp: 1_000_000,
    maxHp: 1_000_000,
    stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, speed: 100, attack: 0 },
  })

  const playerParticipant = makeParticipant('player', player, 100, 0)
  const enemyParticipant = makeParticipant('enemy', enemyEntity, 100, 1)

  const registry = new Registry([...targetBuffs, ...actorBuffs])
  const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000, registry)

  const battle: TurnBattle = {
    players: [playerParticipant],
    enemies: [enemyParticipant],
    state: 'fighting',
  }

  // Pre-apply reactiveTrigger buffs trực tiếp qua TurnBuffSystem (mô phỏng
  // buff đã active trước lượt này).
  for (const def of actorBuffs ?? []) {
    new TurnBuffSystem(playerParticipant.buffs).apply(def, player, player, registry)
  }

  for (const def of targetBuffs) {
    new TurnBuffSystem(enemyParticipant.buffs).apply(def, player, enemyEntity, registry)
  }

  return { battle, system, registry, player, enemyEntity }
}

describe('TurnBuffSystem — reactiveTrigger effect', () => {
  it('onCastBegin: roll trúng → áp appliesDefinitionId buff lên actor, CC-check sau đó block turn (ccBlocked=true, 0 hit)', () => {
    const { battle, system, enemyEntity } = fixture([STUN_DEF], [PUNISH_DEF])

    const actor = system.peekNextActor(battle)!

    const declared = system.declareActorAction(battle, actor)

    // Punish fired → stun applied → ccBlocked đúng như spec §4.2 ordering.
    expect(declared.ccBlocked).toBe(true)

    const { targetIds } = system.applyActionImpact(battle, declared)

    expect(targetIds).toEqual([])
    expect(enemyEntity.currentHp).toBe(1_000_000)
  })

  it('onImpactLanded: roll trúng trên target + queuesFollowUp → battle.queuedFollowUpActorId = target.id', () => {
    const { battle, system } = fixture([COUNTER_DEF])

    const actor = system.peekNextActor(battle)!

    const declared = system.declareActorAction(battle, actor)
    const { targetIds } = system.applyActionImpact(battle, declared)

    expect(targetIds).toEqual(['enemy'])
    expect(battle.queuedFollowUpActorIds).toEqual(['enemy'])
  })

  it('chance=0 không bao giờ fire', () => {
    const NO_FIRE: TurnBuffDefinition = {
      id: 'react_none',
      name: 'No Fire',
      polarity: 'buff',
      duration: 2,
      stackMode: 'refresh',
      effects: [{ type: 'reactiveTrigger', trigger: 'onImpactLanded', chance: 0, queuesFollowUp: true }],
    }

    const { battle, system } = fixture([NO_FIRE])

    const actor = system.peekNextActor(battle)!
    const declared = system.declareActorAction(battle, actor)
    system.applyActionImpact(battle, declared)

    expect(battle.queuedFollowUpActorIds).toBeUndefined()
  })

  it('queuedFollowUpActorId → peekNextActor lần KẾ trả actor đó trực tiếp (bypass gauge)', () => {
    const { battle, system } = fixture([COUNTER_DEF])

    const actor = system.peekNextActor(battle)!
    const declared = system.declareActorAction(battle, actor)
    const { targetIds } = system.applyActionImpact(battle, declared)
    system.completeAction(battle, actor, declared, targetIds)

    expect(battle.queuedFollowUpActorIds).toEqual(['enemy'])

    const next = system.peekNextActor(battle)

    expect(next?.id).toBe('enemy')
    expect(battle.queuedFollowUpActorIds).toBeUndefined()
  })
})

// Defect-fix Task 1 — helper cũ chạy applyActionImpact lần 2 (re-apply →
// push queue 2 entry). Đã inline tại call site, helper giữ chỉ để không
// vỡ signature cũ nếu test khác tham chiếu.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function targetIdsHelper(
  declared: Parameters<TurnBattleSystem['applyActionImpact']>[1],
  battle: TurnBattle,
  system: TurnBattleSystem,
): string[] {
  return system.applyActionImpact(battle, declared).targetIds
}
