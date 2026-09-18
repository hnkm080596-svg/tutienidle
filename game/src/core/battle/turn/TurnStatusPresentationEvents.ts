import type { EventBus } from '../../events/EventBus'
import type { TurnBattle, TurnBattleParticipant } from './TurnBattleSystem'
import type { BuffRegistry } from '../../buff2/BuffRegistry'
import type { BuffReadPort } from '../../buff2/BuffQuery'
import type { CombatEntityId } from '../../battle/contracts/ids'
import { BUFF_REGISTRY } from '../../../data/buff/BuffRegistry'

// Phase A6 (9.5 #7, 2026-09-12) — turn-based port of the legacy
// BattleSystem.snapshotStatuses()/emitStatusVfxDiff() pair (retired at
// C1). buff2 M4: reads the battle's buff authority snapshots + the
// battle-local registry for def fields (hidden/polarity) — the def
// carries display metadata, the instance carries runtime state. Reuses
// the SAME status_vfx_* event names and payload field names so
// CombatVfxSpawner/CombatScene/StatusTooltip need zero structural
// changes; the tooltip renders the duration number as a turn count (see
// combat-status-tooltip.ts). GameManagerTurnBattleOps is the sole
// caller — snapshot before the step mutates, diff-emit at the existing
// emitTurnBattleEntitySnapshot point. Read-only over the authority
// (P17): this module never mutates buff state.

export interface TurnStatusSnapshotEntry {
  targetId: string
  dotType: string
  stacks: number
  remainingTurns: number
  polarity: 'buff' | 'debuff'
  permanent: boolean
}

function collectParticipantStatuses(
  participant: TurnBattleParticipant,
  buffs: BuffReadPort,
  registry: BuffRegistry,
  snapshot: Map<string, TurnStatusSnapshotEntry>,
): void {
  for (const instance of buffs.getForTarget(participant.entity.id as CombatEntityId)) {
    const definition = registry.tryGet(instance.definitionId)
    if (definition === undefined || definition.hidden === true) {
      continue
    }

    const permanent = instance.remaining === undefined
    snapshot.set(`${participant.id}:${instance.definitionId}:${instance.sourceId}`, {
      targetId: participant.id,
      dotType: instance.definitionId,
      stacks: instance.stacks,
      remainingTurns: instance.remaining ?? Number.POSITIVE_INFINITY,
      polarity:
        definition.polarity ??
        (definition.kind === 'debuff' || definition.kind === 'ailment' ? 'debuff' : 'buff'),
      permanent,
    })
  }
}

export function snapshotTurnStatuses(
  battle: TurnBattle,
  buffs: BuffReadPort,
  registry: BuffRegistry,
): Map<string, TurnStatusSnapshotEntry> {
  const snapshot = new Map<string, TurnStatusSnapshotEntry>()

  for (const participant of battle.players) {
    collectParticipantStatuses(participant, buffs, registry, snapshot)
  }

  for (const participant of battle.enemies) {
    collectParticipantStatuses(participant, buffs, registry, snapshot)
  }

  return snapshot
}

function buffNameFor(id: string): string {
  try {
    return BUFF_REGISTRY.get(id).name
  } catch {
    return id
  }
}

export function diffAndEmitTurnStatusVfx(
  eventBus: EventBus,
  battle: TurnBattle,
  before: Map<string, TurnStatusSnapshotEntry>,
  buffs: BuffReadPort,
  registry: BuffRegistry,
): Map<string, TurnStatusSnapshotEntry> {
  const after = snapshotTurnStatuses(battle, buffs, registry)

  for (const [key, current] of after) {
    const previous = before.get(key)

    if (!previous) {
      // durationSeconds keeps its established event field name but now
      // carries a TURN count (full cutover — no seconds/turns dual mode).
      eventBus.emit('status_vfx_attached', {
        type: 'status_vfx_attached',
        statusInstanceId: key,
        targetId: current.targetId,
        dotType: current.dotType,
        stacks: current.stacks,
        durationSeconds: current.remainingTurns,
        buffName: buffNameFor(current.dotType),
        polarity: current.polarity,
        permanent: current.permanent,
      })
    } else if (current.stacks !== previous.stacks || current.remainingTurns > previous.remainingTurns) {
      // Deliberate `>` vs legacy's `>=`: remainingTime decayed every
      // fixed-step so >= meant "refresh only"; remainingTurns only ticks
      // on the holder's turn, so >= would emit a spurious update every
      // step between ticks. > preserves the intent — stack change or
      // upward refresh only; plain decay and no-change stay silent.
      eventBus.emit('status_vfx_updated', {
        type: 'status_vfx_updated',
        statusInstanceId: key,
        stacks: current.stacks,
        durationSeconds: current.remainingTurns,
      })
    }
  }

  for (const [key, previous] of before) {
    if (after.has(key)) {
      continue
    }

    const holder = [...battle.players, ...battle.enemies].find(
      (participant) => participant.id === previous.targetId,
    )
    const alive = holder?.entity.alive ?? false

    eventBus.emit('status_vfx_removed', {
      type: 'status_vfx_removed',
      statusInstanceId: key,
      reason: alive ? 'expired' : 'target_dead',
    })
  }

  // Caller stores the returned map as the next step's `before` — a
  // persistent last-emitted snapshot, NOT a fresh per-step capture, so a
  // buff applied at construction/intro/countdown is still seen as "new"
  // on the first fighting step (attach) instead of silently matching
  // a step-start snapshot that already contained it.
  return after
}
