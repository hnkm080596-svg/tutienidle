import { describe, expect, it } from 'vitest'
import { EventBus } from '../../events/EventBus'
import {
  snapshotTurnStatuses,
  diffAndEmitTurnStatusVfx,
  type TurnStatusSnapshotEntry,
} from './TurnStatusPresentationEvents'
import { BuffPool } from '../../buff/BuffPool'
import type { TurnBattle, TurnBattleParticipant } from './TurnBattleSystem'
import type { Buff } from '../../buff/BuffTypes'
import type { CombatEntity } from '../../combat/CombatEntity'
import { createBaseStats } from '../../stats/StatBlock'
import type {
  StatusVfxAttachedEvent,
  StatusVfxUpdatedEvent,
  StatusVfxRemovedEvent,
} from '../BattleEvents'

// Phase A6 (9.5 #7) — turn-based status presentation feed. Fixture shape
// copied from TurnActionPresentationEvents.test.ts (per-file fixture
// convention of this suite); buff fixture shape from BuffPool.test.ts.
function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0 })
  return {
    id: 'id', name: 'name', type: 'enemy', baseStats: stats, stats,
    currentHp: stats.maxHp, maxHp: stats.maxHp, currentMp: stats.maxMp,
    currentSwordIntent: 0, currentMomentum: 0, currentHoaThe: 0, currentThoThe: 0, currentKimThe: 0,
    timeSinceLastBleedProc: 0, tuLucActive: false, tuLucElapsed: 0, tuLucDamageTakenPercent: 0,
    currentWard: 0, timeSinceLastHitTaken: Infinity, realmIndex: 0, x: 0, row: 2, alive: true,
    ...overrides,
  } as CombatEntity
}

function makeParticipant(id: string, entity: CombatEntity): TurnBattleParticipant {
  return {
    id, entity, speed: 100, priority: 0, actionGauge: 0, alive: entity.alive,
    buffs: new BuffPool(), consecutiveHardCcTurns: 0,
  }
}

function makeBuff(overrides: Partial<Buff> = {}): Buff {
  return {
    id: 'test_buff',
    sourceId: 'source_1',
    targetId: 'player',
    polarity: 'debuff',
    duration: 5,
    remainingTurns: 5,
    stacks: 1,
    stackMode: 'refresh',
    continuousTurns: 0,
    effects: [],
    ...overrides,
  }
}

function makeBattle(participants: { players?: TurnBattleParticipant[]; enemies?: TurnBattleParticipant[] }): TurnBattle {
  return {
    players: participants.players ?? [],
    enemies: participants.enemies ?? [],
    state: 'fighting',
  }
}

describe('snapshotTurnStatuses', () => {
  it('keys entries by targetId:buffId:sourceId reading remainingTurns/stacks/polarity/permanent', () => {
    const player = makeParticipant('player', createCombatant({ id: 'player' }))
    player.buffs.add(makeBuff({ id: 'burn', targetId: 'player', stacks: 2, remainingTurns: 3 }))

    const enemy = makeParticipant('enemy', createCombatant({ id: 'enemy' }))
    enemy.buffs.add(makeBuff({ id: 'ward', sourceId: 'src_x', targetId: 'enemy', polarity: 'buff', duration: Infinity, remainingTurns: Infinity }))

    const snapshot = snapshotTurnStatuses(makeBattle({ players: [player], enemies: [enemy] }))

    expect(snapshot.size).toBe(2)
    expect(snapshot.get('player:burn:source_1')).toEqual({
      targetId: 'player', dotType: 'burn', stacks: 2, remainingTurns: 3, polarity: 'debuff', permanent: false,
    })
    expect(snapshot.get('enemy:ward:src_x')!.permanent).toBe(true)
  })

  it('skips hidden buffs (same convention as the buff pipeline)', () => {
    const player = makeParticipant('player', createCombatant({ id: 'player' }))
    player.buffs.add(makeBuff({ hidden: true }))

    expect(snapshotTurnStatuses(makeBattle({ players: [player] })).size).toBe(0)
  })
})

describe('diffAndEmitTurnStatusVfx', () => {
  function collect(bus: EventBus) {
    const attached: StatusVfxAttachedEvent[] = []
    const updated: StatusVfxUpdatedEvent[] = []
    const removed: StatusVfxRemovedEvent[] = []
    bus.on<StatusVfxAttachedEvent>('status_vfx_attached', (e) => attached.push(e))
    bus.on<StatusVfxUpdatedEvent>('status_vfx_updated', (e) => updated.push(e))
    bus.on<StatusVfxRemovedEvent>('status_vfx_removed', (e) => removed.push(e))
    return { attached, updated, removed }
  }

  it('emits status_vfx_attached for a buff present in after but not before, durationSeconds = turns', () => {
    const bus = new EventBus()
    const events = collect(bus)
    const player = makeParticipant('player', createCombatant({ id: 'player' }))
    player.buffs.add(makeBuff({ id: 'trung_doc', remainingTurns: 4 }))

    diffAndEmitTurnStatusVfx(bus, makeBattle({ players: [player] }), new Map())

    expect(events.attached).toHaveLength(1)
    expect(events.attached[0]).toMatchObject({
      statusInstanceId: 'player:trung_doc:source_1',
      targetId: 'player',
      dotType: 'trung_doc',
      stacks: 1,
      durationSeconds: 4,
      polarity: 'debuff',
      permanent: false,
    })
    // buffName resolves through BUFF_REGISTRY for a known id.
    expect(events.attached[0]!.buffName).toBeTruthy()
    expect(events.attached[0]!.buffName).not.toBe('trung_doc')
  })

  it('falls back to the raw id for a buff the registry does not know', () => {
    const bus = new EventBus()
    const events = collect(bus)
    const player = makeParticipant('player', createCombatant({ id: 'player' }))
    player.buffs.add(makeBuff({ id: 'totally_unknown_buff_id' }))

    diffAndEmitTurnStatusVfx(bus, makeBattle({ players: [player] }), new Map())

    expect(events.attached[0]!.buffName).toBe('totally_unknown_buff_id')
  })

  it('emits status_vfx_updated when stacks change or remainingTurns refresh upward; silent on plain decay', () => {
    const bus = new EventBus()
    const events = collect(bus)
    const player = makeParticipant('player', createCombatant({ id: 'player' }))
    player.buffs.add(makeBuff({ id: 'burn', stacks: 2, remainingTurns: 5 }))
    const battle = makeBattle({ players: [player] })

    const before = new Map<string, TurnStatusSnapshotEntry>([
      ['player:burn:source_1', { targetId: 'player', dotType: 'burn', stacks: 1, remainingTurns: 3, polarity: 'debuff', permanent: false }],
    ])

    diffAndEmitTurnStatusVfx(bus, battle, before)
    expect(events.updated).toHaveLength(1)
    expect(events.updated[0]).toMatchObject({ statusInstanceId: 'player:burn:source_1', stacks: 2, durationSeconds: 5 })

    // Plain decay (stacks same, remainingTurns lower) must NOT emit —
    // otherwise every tick spams an update event.
    events.updated.length = 0
    const beforeDecayed = new Map<string, TurnStatusSnapshotEntry>([
      ['player:burn:source_1', { targetId: 'player', dotType: 'burn', stacks: 2, remainingTurns: 9, polarity: 'debuff', permanent: false }],
    ])
    diffAndEmitTurnStatusVfx(bus, battle, beforeDecayed)
    expect(events.updated).toHaveLength(0)
  })

  it('emits status_vfx_removed reason "expired" when a living holder loses the buff', () => {
    const bus = new EventBus()
    const events = collect(bus)
    const player = makeParticipant('player', createCombatant({ id: 'player' }))

    const before = new Map<string, TurnStatusSnapshotEntry>([
      ['player:burn:source_1', { targetId: 'player', dotType: 'burn', stacks: 1, remainingTurns: 1, polarity: 'debuff', permanent: false }],
    ])

    diffAndEmitTurnStatusVfx(bus, makeBattle({ players: [player] }), before)

    expect(events.removed).toHaveLength(1)
    expect(events.removed[0]).toMatchObject({ statusInstanceId: 'player:burn:source_1', reason: 'expired' })
  })

  it('emits status_vfx_removed reason "target_dead" when the holder died or left the battle', () => {
    const bus = new EventBus()
    const events = collect(bus)
    const enemy = makeParticipant('enemy', createCombatant({ id: 'enemy', alive: false }))

    const before = new Map<string, TurnStatusSnapshotEntry>([
      ['enemy:burn:source_1', { targetId: 'enemy', dotType: 'burn', stacks: 1, remainingTurns: 2, polarity: 'debuff', permanent: false }],
    ])

    diffAndEmitTurnStatusVfx(bus, makeBattle({ enemies: [enemy] }), before)
    expect(events.removed[0]!.reason).toBe('target_dead')

    // Holder gone from the battle entirely (e.g. dead participants can be
    // filtered out of battle.enemies) — still target_dead.
    events.removed.length = 0
    diffAndEmitTurnStatusVfx(bus, makeBattle({}), before)
    expect(events.removed[0]!.reason).toBe('target_dead')
  })

  it('emits nothing when before and after match', () => {
    const bus = new EventBus()
    const events = collect(bus)
    const player = makeParticipant('player', createCombatant({ id: 'player' }))
    player.buffs.add(makeBuff({ id: 'burn', stacks: 1, remainingTurns: 5 }))

    const before = snapshotTurnStatuses(makeBattle({ players: [player] }))
    diffAndEmitTurnStatusVfx(bus, makeBattle({ players: [player] }), before)

    expect(events.attached).toHaveLength(0)
    expect(events.updated).toHaveLength(0)
    expect(events.removed).toHaveLength(0)
  })
})
