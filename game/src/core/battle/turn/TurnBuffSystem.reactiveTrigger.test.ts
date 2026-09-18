import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { BuffDefinition } from '../../buff2/BuffDefinition'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { asBaseStats, createBaseStats } from '../../stats/StatBlock'
import { makeTestBuffRegistry, makeTurnRuntime } from './testing/TurnRuntimeFixtures'

// Action Playback Task 5 — reactiveTrigger buff effect:
//   onCastBegin    — roll khi actor bắt đầu cast (punish-on-cast); nếu áp
//                    hard-CC buff, CC-check kế tiếp block turn (ccBlocked)
//   onImpactLanded — roll trên TARGET bị hit (counter); queuesFollowUp
//                    đặt battle.queuedFollowUpActorId (counter-turn)

const PERMANENT = { clock: 'permanent', scaling: 'fixed' } as const

const STUN_DEF: BuffDefinition = {
  id: 'react_stun',
  name: 'Punish Stun',
  kind: 'ailment',
  polarity: 'debuff',
  instanceScope: 'per_source',
  stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
  lifetime: { clock: 'holder_turns', duration: 1, scaling: 'ailment_scaled' },
  application: { resistance: 'ailment' },
  controls: [{ type: 'stun' }],
  dispellable: true,
}

const COUNTER_DEF: BuffDefinition = {
  id: 'react_counter',
  name: 'Counter Stance',
  kind: 'buff',
  polarity: 'buff',
  instanceScope: 'per_source',
  stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
  lifetime: { clock: 'holder_turns', duration: 2, scaling: 'fixed' },
  capabilities: [
    {
      id: 'react_counter.trigger',
      type: 'reactive_trigger',
      payload: { trigger: 'onImpactLanded', chance: 1, queuesFollowUp: true },
    },
  ],
  dispellable: false,
}

const PUNISH_DEF: BuffDefinition = {
  id: 'react_punish',
  name: 'Punish Stance',
  kind: 'buff',
  polarity: 'buff',
  instanceScope: 'per_source',
  stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
  lifetime: { clock: 'holder_turns', duration: 2, scaling: 'fixed' },
  capabilities: [
    {
      id: 'react_punish.trigger',
      type: 'reactive_trigger',
      payload: { trigger: 'onCastBegin', chance: 1, appliesDefinitionId: 'react_stun' },
    },
  ],
  dispellable: false,
}

function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0 })

  const entity = {
    id: 'id', name: 'name', type: 'enemy', baseStats: stats, stats,
    currentHp: stats.maxHp, maxHp: stats.maxHp, currentMp: stats.maxMp,
    currentWard: 0, turnsSinceLastHitLanded: Infinity, realmIndex: 0, x: 0, row: 2, alive: true,
    ...overrides,
  } as CombatEntity

  // ARCH-002 (M7 R1): refreshParticipantStats reconciles entity.maxHp from
  // entity.stats.maxHp and clamps currentHp — the fixture's declared vitals
  // ceiling must exist in the resolved/base stats or refresh reverts it.
  entity.baseStats = (overrides.baseStats ?? overrides.stats ?? entity.baseStats) as CombatEntity['baseStats']
  const ceiling = Math.max(entity.maxHp, entity.currentHp)
  if (entity.stats.maxHp !== ceiling) {
    entity.stats = { ...entity.stats, maxHp: ceiling }
    entity.baseStats = asBaseStats({ ...entity.baseStats, maxHp: ceiling })
  }
  return entity
}

function makeParticipant(
  id: string,
  entity: CombatEntity,
  speed: number,
  priority: number,
): TurnBattleParticipant {
  return {
    id, entity, speed, priority, actionGauge: 0, alive: entity.alive,
    consecutiveHardCcTurns: 0,
    basic: { id: `${id}_basic`, cooldownTurns: 0, damage: { kind: 'physical', multiplier: 1 }, targeting: { shape: 'single' } },
  }
}

function fixture(targetBuffs: BuffDefinition[], actorBuffs: BuffDefinition[] = []) {
  const player = createCombatant({
    id: 'player',
    type: 'player',
    row: 4,
    stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, speed: 100, might: 100 }),
  })
  const enemyEntity = createCombatant({
    id: 'enemy',
    currentHp: 1_000_000,
    maxHp: 1_000_000,
    stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, speed: 100, might: 0 }),
  })

  const playerParticipant = makeParticipant('player', player, 100, 0)
  const enemyParticipant = makeParticipant('enemy', enemyEntity, 100, 1)

  const registry = makeTestBuffRegistry([...targetBuffs, ...actorBuffs])
  const combat = new CombatSystem(new EventBus())

  const battle: TurnBattle = {
    players: [playerParticipant],
    enemies: [enemyParticipant],
    state: 'fighting',
  }

  const runtime = makeTurnRuntime({
    registry,
    participants: () => [playerParticipant, enemyParticipant],
    combatSystem: combat,
  })
  const system = new TurnBattleSystem(combat, 10_000, registry, undefined, runtime)

  // Pre-apply reactive_trigger buffs through the authority (mô phỏng
  // buff đã active trước lượt này).
  for (const def of actorBuffs ?? []) {
    runtime.applyBuff(def.id, playerParticipant)
  }

  for (const def of targetBuffs) {
    runtime.applyBuff(def.id, enemyParticipant, playerParticipant)
  }

  return { battle, system, registry, runtime, player, enemyEntity }
}

describe('BuffSystem — reactiveTrigger effect', () => {
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
    expect(battle.queuedFollowUps?.map((entry) => entry.actorId)).toEqual(['enemy'])
  })

  it('chance=0 không bao giờ fire', () => {
    const NO_FIRE: BuffDefinition = {
      id: 'react_none',
      name: 'No Fire',
      kind: 'buff',
      polarity: 'buff',
      instanceScope: 'per_source',
      stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
      lifetime: PERMANENT,
      capabilities: [
        {
          id: 'react_none.trigger',
          type: 'reactive_trigger',
          payload: { trigger: 'onImpactLanded', chance: 0, queuesFollowUp: true },
        },
      ],
      dispellable: false,
    }

    const { battle, system } = fixture([NO_FIRE])

    const actor = system.peekNextActor(battle)!
    const declared = system.declareActorAction(battle, actor)
    system.applyActionImpact(battle, declared)

    expect(battle.queuedFollowUps).toBeUndefined()
  })

  it('queuedFollowUps → peekNextActor lần KẾ trả actor đó trực tiếp (bypass gauge)', () => {
    const { battle, system } = fixture([COUNTER_DEF])

    const actor = system.peekNextActor(battle)!
    const declared = system.declareActorAction(battle, actor)
    const { targetIds } = system.applyActionImpact(battle, declared)
    system.completeAction(battle, actor, declared, targetIds)

    expect(battle.queuedFollowUps?.map((entry) => entry.actorId)).toEqual(['enemy'])

    const next = system.peekNextActor(battle)

    expect(next?.id).toBe('enemy')
    expect(battle.queuedFollowUps).toBeUndefined()
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
