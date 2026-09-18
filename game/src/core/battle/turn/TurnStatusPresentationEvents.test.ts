import { describe, expect, it } from 'vitest'
import { EventBus } from '../../events/EventBus'
import { CombatSystem } from '../../combat/CombatSystem'
import {
  snapshotTurnStatuses,
  diffAndEmitTurnStatusVfx,
  type TurnStatusSnapshotEntry,
} from './TurnStatusPresentationEvents'
import type { TurnBattle, TurnBattleParticipant } from './TurnBattleSystem'
import type { BuffDefinition } from '../../buff2/BuffDefinition'
import type { BuffDefinitionId } from '../contracts/ids'
import type { CombatEntity } from '../../combat/CombatEntity'
import { createBaseStats } from '../../stats/StatBlock'
import type {
  StatusVfxAttachedEvent,
  StatusVfxUpdatedEvent,
  StatusVfxRemovedEvent,
} from '../BattleEvents'
import { makeTestBuffRegistry, makeTurnRuntime } from './testing/TurnRuntimeFixtures'

// Phase A6 (9.5 #7) — turn-based status presentation feed. Fixture shape
// copied from TurnActionPresentationEvents.test.ts (per-file fixture
// convention of this suite). buff2 M4: instances are seeded through the
// shared test runtime's buff authority; def metadata (hidden/polarity)
// resolves through a test registry.
function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0 })
  return {
    id: 'id', name: 'name', type: 'enemy', baseStats: stats, stats,
    currentHp: stats.maxHp, maxHp: stats.maxHp, currentMp: stats.maxMp,
    currentWard: 0, turnsSinceLastHitLanded: Infinity, realmIndex: 0, x: 0, row: 2, alive: true,
    ...overrides,
  } as CombatEntity
}

function makeParticipant(id: string, entity: CombatEntity): TurnBattleParticipant {
  return {
    id, entity, speed: 100, priority: 0, actionGauge: 0, alive: entity.alive,
    consecutiveHardCcTurns: 0,
  }
}

function buffDef(
  id: string,
  polarity: 'buff' | 'debuff',
  extra?: Partial<BuffDefinition>,
): BuffDefinition {
  return {
    id: id as BuffDefinitionId,
    name: id,
    kind: polarity,
    polarity,
    instanceScope: 'per_target',
    stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 5, scaling: 'fixed' },
    dispellable: true,
    ...extra,
  }
}

// 'trung_doc' stays unregistered HERE — buffNameFor resolves its display
// name through the production BUFF_REGISTRY (real def); the other ids are
// test-only.
const REGISTRY = makeTestBuffRegistry([
  buffDef('burn', 'debuff'),
  buffDef('ward', 'buff'),
  buffDef('trung_doc', 'debuff'),
  buffDef('test_buff', 'debuff'),
  buffDef('hidden_probe', 'debuff', { hidden: true }),
  buffDef('totally_unknown_buff_id', 'debuff'),
])

function makeBattle(participants: { players?: TurnBattleParticipant[]; enemies?: TurnBattleParticipant[] }): TurnBattle {
  return {
    players: participants.players ?? [],
    enemies: participants.enemies ?? [],
    state: 'fighting',
  }
}

function makeWorld(participants: TurnBattleParticipant[]) {
  const combat = new CombatSystem(new EventBus())
  const runtime = makeTurnRuntime({
    registry: REGISTRY,
    participants: () => participants,
    combatSystem: combat,
  })

  return runtime
}

describe('snapshotTurnStatuses', () => {
  it('keys entries by targetId:buffId:sourceId reading remainingTurns/stacks/polarity/permanent', () => {
    const player = makeParticipant('player', createCombatant({ id: 'player' }))
    const enemy = makeParticipant('enemy', createCombatant({ id: 'enemy' }))
    const source = makeParticipant('source_1', createCombatant({ id: 'source_1' }))
    const srcX = makeParticipant('src_x', createCombatant({ id: 'src_x' }))
    const runtime = makeWorld([player, enemy, source, srcX])

    runtime.applyBuff('burn', player, source, { stacks: 2, durationOverride: 3 })
    runtime.applyBuff('ward', enemy, srcX, { durationOverride: undefined })

    // ward permanent: reseed with a permanent-clock def via a dedicated
    // registry lane is overkill — durationOverride undefined lands the
    // authored 5-turn duration, so use a permanent def instead.
    const snapshot = snapshotTurnStatuses(
      makeBattle({ players: [player], enemies: [enemy] }),
      runtime.buffs,
      REGISTRY,
    )

    expect(snapshot.size).toBe(2)
    expect(snapshot.get('player:burn:source_1')).toEqual({
      targetId: 'player', dotType: 'burn', stacks: 2, remainingTurns: 3, polarity: 'debuff', permanent: false,
    })
    expect(snapshot.get('enemy:ward:src_x')).toMatchObject({ polarity: 'buff' })
  })

  it('permanent-clock instances report permanent: true', () => {
    const permanentRegistry = makeTestBuffRegistry([
      buffDef('ward', 'buff', { lifetime: { clock: 'permanent', scaling: 'fixed' } }),
    ])
    const enemy = makeParticipant('enemy', createCombatant({ id: 'enemy' }))
    const combat = new CombatSystem(new EventBus())
    const runtime = makeTurnRuntime({
      registry: permanentRegistry,
      participants: () => [enemy],
      combatSystem: combat,
    })
    runtime.applyBuff('ward', enemy)

    const snapshot = snapshotTurnStatuses(
      makeBattle({ enemies: [enemy] }),
      runtime.buffs,
      permanentRegistry,
    )

    expect(snapshot.get('enemy:ward:enemy')!.permanent).toBe(true)
  })

  it('skips hidden buffs (same convention as the buff pipeline)', () => {
    const player = makeParticipant('player', createCombatant({ id: 'player' }))
    const runtime = makeWorld([player])
    runtime.applyBuff('hidden_probe', player)

    expect(
      snapshotTurnStatuses(makeBattle({ players: [player] }), runtime.buffs, REGISTRY).size,
    ).toBe(0)
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
    const source = makeParticipant('source_1', createCombatant({ id: 'source_1' }))
    const runtime = makeWorld([player, source])
    runtime.applyBuff('trung_doc', player, source, { durationOverride: 4 })
    const battle = makeBattle({ players: [player] })

    diffAndEmitTurnStatusVfx(bus, battle, new Map(), runtime.buffs, REGISTRY)

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
    const runtime = makeWorld([player])
    runtime.applyBuff('totally_unknown_buff_id', player)
    const battle = makeBattle({ players: [player] })

    diffAndEmitTurnStatusVfx(bus, battle, new Map(), runtime.buffs, REGISTRY)

    expect(events.attached[0]!.buffName).toBe('totally_unknown_buff_id')
  })

  it('emits status_vfx_updated when stacks change or remainingTurns refresh upward; silent on plain decay', () => {
    const bus = new EventBus()
    const events = collect(bus)
    const player = makeParticipant('player', createCombatant({ id: 'player' }))
    const source = makeParticipant('source_1', createCombatant({ id: 'source_1' }))
    const runtime = makeWorld([player, source])
    runtime.applyBuff('burn', player, source, { stacks: 2, durationOverride: 5 })
    const battle = makeBattle({ players: [player] })

    const before = new Map<string, TurnStatusSnapshotEntry>([
      ['player:burn:source_1', { targetId: 'player', dotType: 'burn', stacks: 1, remainingTurns: 3, polarity: 'debuff', permanent: false }],
    ])

    diffAndEmitTurnStatusVfx(bus, battle, before, runtime.buffs, REGISTRY)
    expect(events.updated).toHaveLength(1)
    expect(events.updated[0]).toMatchObject({ statusInstanceId: 'player:burn:source_1', stacks: 2, durationSeconds: 5 })

    // Plain decay (stacks same, remainingTurns lower) must NOT emit —
    // otherwise every tick spams an update event.
    events.updated.length = 0
    const beforeDecayed = new Map<string, TurnStatusSnapshotEntry>([
      ['player:burn:source_1', { targetId: 'player', dotType: 'burn', stacks: 2, remainingTurns: 9, polarity: 'debuff', permanent: false }],
    ])
    diffAndEmitTurnStatusVfx(bus, battle, beforeDecayed, runtime.buffs, REGISTRY)
    expect(events.updated).toHaveLength(0)
  })

  it('emits status_vfx_removed reason "expired" when a living holder loses the buff', () => {
    const bus = new EventBus()
    const events = collect(bus)
    const player = makeParticipant('player', createCombatant({ id: 'player' }))
    const runtime = makeWorld([player])

    const before = new Map<string, TurnStatusSnapshotEntry>([
      ['player:burn:source_1', { targetId: 'player', dotType: 'burn', stacks: 1, remainingTurns: 1, polarity: 'debuff', permanent: false }],
    ])

    diffAndEmitTurnStatusVfx(bus, makeBattle({ players: [player] }), before, runtime.buffs, REGISTRY)

    expect(events.removed).toHaveLength(1)
    expect(events.removed[0]).toMatchObject({ statusInstanceId: 'player:burn:source_1', reason: 'expired' })
  })

  it('emits status_vfx_removed reason "target_dead" when the holder died or left the battle', () => {
    const bus = new EventBus()
    const events = collect(bus)
    const enemy = makeParticipant('enemy', createCombatant({ id: 'enemy', alive: false }))
    const runtime = makeWorld([enemy])

    const before = new Map<string, TurnStatusSnapshotEntry>([
      ['enemy:burn:source_1', { targetId: 'enemy', dotType: 'burn', stacks: 1, remainingTurns: 2, polarity: 'debuff', permanent: false }],
    ])

    diffAndEmitTurnStatusVfx(bus, makeBattle({ enemies: [enemy] }), before, runtime.buffs, REGISTRY)
    expect(events.removed[0]!.reason).toBe('target_dead')

    // Holder gone from the battle entirely (e.g. dead participants can be
    // filtered out of battle.enemies) — still target_dead.
    events.removed.length = 0
    diffAndEmitTurnStatusVfx(bus, makeBattle({}), before, runtime.buffs, REGISTRY)
    expect(events.removed[0]!.reason).toBe('target_dead')
  })

  it('emits nothing when before and after match', () => {
    const bus = new EventBus()
    const events = collect(bus)
    const player = makeParticipant('player', createCombatant({ id: 'player' }))
    const source = makeParticipant('source_1', createCombatant({ id: 'source_1' }))
    const runtime = makeWorld([player, source])
    runtime.applyBuff('burn', player, source, { stacks: 1, durationOverride: 5 })
    const battle = makeBattle({ players: [player] })

    const before = snapshotTurnStatuses(battle, runtime.buffs, REGISTRY)
    diffAndEmitTurnStatusVfx(bus, battle, before, runtime.buffs, REGISTRY)

    expect(events.attached).toHaveLength(0)
    expect(events.updated).toHaveLength(0)
    expect(events.removed).toHaveLength(0)
  })
})
