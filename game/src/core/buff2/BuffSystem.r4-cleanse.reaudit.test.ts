import { describe, expect, it } from 'vitest'
import { CombatSystem, type SurviveEffectsPolicy } from '../combat/CombatSystem'
import type { CombatEntity } from '../combat/CombatEntity'
import { EventBus } from '../events/EventBus'
import { createBaseStats } from '../stats/StatBlock'
import { SurviveLethalGuard } from '../talent/SurviveLethalGuard'
import { BUFF_REGISTRY } from '../../data/buff/BuffRegistry'
import type { CombatEntityId, CombatOperationId } from '../battle/contracts/ids'
import type { CombatAuthorityExecutionContext } from '../battle/contracts/context'
import type { ResolvedCombatOperation } from '../battle/contracts/operations'
import type { TurnBattleParticipant } from '../battle/turn/TurnBattleSystem'
import {
  makeTurnRuntime,
  type TurnRuntimeFixture,
} from '../battle/turn/testing/TurnRuntimeFixtures'

// R4 canonical buff lifecycle reaudit (buff2 M4 port) -- a DoT tick that
// kills its holder mid-boundary must NOT let a second DoT tick after
// the survive-lethal cleanse removes it. The parity mechanism is the
// per-unit revalidation in emitLifecycleUnit: the bong tick settles
// (kill -> survive -> cleanse), then trung_doc's unit looks itself up
// in the store, finds nothing, and emits no request.

function entity(id: string): CombatEntity {
  const stats = createBaseStats({ might: 10000 })
  return {
    id, name: id, type: 'player', baseStats: stats, stats,
    currentHp: 1000, maxHp: 1000, currentMp: stats.maxMp,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity, realmIndex: 0, x: 0, row: 2, alive: true,
  } as CombatEntity
}

function participant(entity: CombatEntity): TurnBattleParticipant {
  return {
    id: entity.id,
    entity,
    speed: 0,
    priority: 0,
    actionGauge: 0,
    alive: entity.alive,
    consecutiveHardCcTurns: 0,
  }
}

/** The composition-root-bound survive lane (mirrors
    GameManagerTurnBattleOps): mid-settlement reuses the frame ctx;
    quiescent mints authored ops and settles. */
function bindSurviveEffects(runtime: TurnRuntimeFixture): SurviveEffectsPolicy {
  return {
    cleanseDebuffs: true,
    apply: (target, resolved, execCtx: CombatAuthorityExecutionContext | undefined) => {
      const entityId = target.id as CombatEntityId
      if (execCtx !== undefined) {
        if (resolved.cleanseDebuffs) {
          runtime.buffs.cleanse(entityId, { polarity: 'debuff' }, execCtx)
        }
        return
      }
      if (!resolved.cleanseDebuffs) return
      const root = `survive.test.${target.id}`
      const ops: ResolvedCombatOperation[] = [
        {
          type: 'cleanse_buff',
          operationId: `${root}.cleanse` as CombatOperationId,
          payload: { targetId: entityId, query: { polarity: 'debuff' } },
          origin: {
            kind: 'proc',
            originId: 'survive_effects',
            sourceId: entityId,
            rootActionId: root,
          },
        },
      ]
      runtime.scheduler.enqueueAuthored(ops)
      runtime.scheduler.runIfQuiescent()
    },
  }
}

describe('R4 canonical buff lifecycle reaudit', () => {
  it('does not tick a second DoT after survive-lethal cleanses it in the same boundary', () => {
    const source = entity('enemy')
    const target = entity('player')
    const sourceP = participant(source)
    const targetP = participant(target)

    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)
    const runtime = makeTurnRuntime({
      registry: BUFF_REGISTRY,
      participants: () => [sourceP, targetP],
      combatSystem: combat,
    })

    const guard = new SurviveLethalGuard()
    guard.beginBattle(['bat_tu_the'])
    combat.setSurviveLethalSession({
      playerEntityId: target.id,
      guard,
      surviveEffects: bindSurviveEffects(runtime),
    })

    runtime.applyBuff('bong', targetP, sourceP)
    runtime.applyBuff('trung_doc', targetP, sourceP)
    target.currentHp = 1

    const damageEffects: string[] = []
    eventBus.on<{ effectId?: string }>('damage', (event) => {
      damageEffects.push(event.effectId ?? '')
    })

    // Drive the holder-turn-end boundary through the shared runtime:
    // the bong tick kills the holder -> survive -> cleanse -> trung_doc
    // is gone before its unit emits.
    runtime.tickHolderTurnsEnd(target.id)

    const debuffs = runtime.buffs
      .getForTarget(target.id as CombatEntityId)
      .filter((instance) => {
        const def = BUFF_REGISTRY.get(instance.definitionId)
        return (def.polarity ?? (def.kind === 'debuff' || def.kind === 'ailment' ? 'debuff' : 'buff')) === 'debuff'
      })

    expect(debuffs).toHaveLength(0)
    expect(target.alive).toBe(true)
    expect(target.currentHp).toBe(1)
    expect(damageEffects).toEqual(['bong.dot'])
  })
})
