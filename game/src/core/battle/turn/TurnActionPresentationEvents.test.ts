import { describe, expect, it, vi } from 'vitest'
import { EventBus } from '../../events/EventBus'
import {
  emitTurnReady,
  emitTurnCastStart,
  emitTurnActionImpact,
  emitTurnStandbyComplete,
  emitTurnBattleEntitySnapshot,
  type TurnBattleEntitySnapshotEvent,
} from './TurnActionPresentationEvents'
import { TurnBuffPool } from './TurnBuffPool'
import type { TurnBattle, TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { createBaseStats } from '../../stats/StatBlock'

// Fixture helpers — copy y hệt shape dùng trong TurnBattleSystem.followUpQueue.test.ts
// (per-file fixture convention của test suite này).
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

function makeParticipant(id: string, entity: CombatEntity, speed: number, priority: number): TurnBattleParticipant {
  return {
    id, entity, speed, priority, actionGauge: 0, alive: entity.alive,
    buffs: new TurnBuffPool(), consecutiveHardCcTurns: 0,
  }
}

// Action Playback Task 4 — presentation event emitter: GameManager là sole
// caller; CombatScene là sole listener. Reuse 'attack'/'action_impact' event
// names/shapes để CombatScene handlers hiện có hoạt động không sửa.

describe('TurnActionPresentationEvents', () => {
  it('emitTurnReady emits turn_ready with actorId', () => {
    const bus = new EventBus()
    const handler = vi.fn()
    bus.on('turn_ready', handler)

    emitTurnReady(bus, 'player-1')

    expect(handler).toHaveBeenCalledWith({ actorId: 'player-1' })
  })

  it('emitTurnCastStart emits attack với CombatScenePayload shape (sourceId/targetId/skillId)', () => {
    const bus = new EventBus()
    const handler = vi.fn()
    bus.on('attack', handler)

    emitTurnCastStart(bus, 'player-1', 'basic_attack', ['enemy-1', 'enemy-2'])

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceId: 'player-1',
        targetId: 'enemy-1',
        skillId: 'basic_attack',
      }),
    )
  })

  it('emitTurnActionImpact emits action_impact với đủ ActionImpactEvent field set', () => {
    const bus = new EventBus()
    const handler = vi.fn()
    bus.on('action_impact', handler)

    emitTurnActionImpact(bus, {
      actionId: 'act-1',
      sourceId: 'player-1',
      primaryTargetId: 'enemy-1',
      anchorCell: { row: 4, column: 2 },
      affectedArea: { shape: 'single', rowStart: 4, rowEnd: 4, colStart: 2, colEnd: 2 },
      affectedTargetIds: ['enemy-1'],
      landedTargetIds: ['enemy-1'],
      dodgedTargetIds: [],
      hitCount: 1,
      presetId: 'slash',
    })

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'action_impact',
        actionId: 'act-1',
        sourceId: 'player-1',
        primaryTargetId: 'enemy-1',
        anchorCell: { row: 4, column: 2 },
        affectedTargetIds: ['enemy-1'],
        landedTargetIds: ['enemy-1'],
        dodgedTargetIds: [],
        hitCount: 1,
        presetId: 'slash',
      }),
    )
  })

  it('emitTurnActionImpact fallback presetId mặc định khi skill không có', () => {
    const bus = new EventBus()
    const handler = vi.fn()
    bus.on('action_impact', handler)

    emitTurnActionImpact(bus, {
      actionId: 'act-2',
      sourceId: 'player-1',
      primaryTargetId: 'enemy-1',
      anchorCell: { row: 4, column: 2 },
      affectedArea: { shape: 'single', rowStart: 4, rowEnd: 4, colStart: 2, colEnd: 2 },
      affectedTargetIds: ['enemy-1'],
      landedTargetIds: ['enemy-1'],
      dodgedTargetIds: [],
      hitCount: 1,
    })

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        presetId: 'arcane_impact',
      }),
    )
  })

  it('emitTurnStandbyComplete emits turn_standby_complete with actorId', () => {
    const bus = new EventBus()
    const handler = vi.fn()
    bus.on('turn_standby_complete', handler)

    emitTurnStandbyComplete(bus, 'player-1')

    expect(handler).toHaveBeenCalledWith({ actorId: 'player-1' })
  })

  describe('emitTurnBattleEntitySnapshot', () => {
    it('emits a snapshot with every living/dead players and enemies participant', () => {
      const eventBus = new EventBus()
      const received: TurnBattleEntitySnapshotEvent[] = []

      eventBus.on<TurnBattleEntitySnapshotEvent>('turn_battle_entity_snapshot', (event) => received.push(event))

      const battle: TurnBattle = {
        players: [makeParticipant('player', createCombatant({ id: 'player', name: 'Player', row: 4, x: 1, currentHp: 80, maxHp: 100 }), 100, 0)],
        enemies: [makeParticipant('enemy', createCombatant({ id: 'enemy', name: 'Boss Enemy', row: 5, x: 9, currentHp: 0, maxHp: 50, alive: false, isBoss: true }), 100, 1)],
        state: 'fighting',
      }

      emitTurnBattleEntitySnapshot(eventBus, battle)

      expect(received).toHaveLength(1)
      expect(received[0]!.players).toEqual([{ id: 'player', name: 'Player', row: 4, column: 1, currentHp: 80, maxHp: 100, alive: true, isBoss: false }])
      expect(received[0]!.enemies).toEqual([{ id: 'enemy', name: 'Boss Enemy', row: 5, column: 9, currentHp: 0, maxHp: 50, alive: false, isBoss: true }])
    })

    it('defaults isBoss to false when CombatEntity.isBoss is undefined', () => {
      const eventBus = new EventBus()
      const received: TurnBattleEntitySnapshotEvent[] = []

      eventBus.on<TurnBattleEntitySnapshotEvent>('turn_battle_entity_snapshot', (event) => received.push(event))

      const battle: TurnBattle = {
        players: [makeParticipant('player', createCombatant({ id: 'player', name: 'Player' }), 100, 0)],
        enemies: [],
        state: 'fighting',
      }

      emitTurnBattleEntitySnapshot(eventBus, battle)

      expect(received[0]!.players[0]!.isBoss).toBe(false)
    })
  })
})
