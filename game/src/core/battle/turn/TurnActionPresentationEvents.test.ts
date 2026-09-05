import { describe, expect, it, vi } from 'vitest'
import { EventBus } from '../../events/EventBus'
import {
  emitTurnReady,
  emitTurnCastStart,
  emitTurnActionImpact,
  emitTurnStandbyComplete,
} from './TurnActionPresentationEvents'

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
})
