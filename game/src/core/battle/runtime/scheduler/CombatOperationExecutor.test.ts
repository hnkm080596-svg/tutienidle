import { describe, expect, it } from 'vitest'

import type { CombatAuthorityExecutionContext } from '../../contracts/context'
import type { CombatEventPayload } from '../../contracts/events'
import type { CombatOperationOrigin } from '../../contracts/origin'
import type {
  BuffModifierPayload,
  DealDamageOperation,
  ResolvedCombatOperation,
} from '../../contracts/operations'
import type { BuffInstanceSelector } from '../../contracts/selectors'
import type { CombatEventSink } from '../../contracts/sink'

import type {
  BuffAuthority,
  CombatAuthorityPorts,
  DamageAuthority,
  GaugeAuthority,
  HealAuthority,
  ResourceAuthority,
  ShieldAuthority,
} from './CombatAuthorityPorts'
import {
  CombatOperationExecutor,
  CombatOperationSkip,
} from './CombatOperationExecutor'
import { CombatSettlementFault } from './CombatSettlementFault'

const ORIGIN: CombatOperationOrigin = {
  kind: 'skill',
  originId: 'skill.test',
  sourceId: 'entity.a',
  rootActionId: 'action.turn.1.a',
}

const SELECTOR: BuffInstanceSelector = { kind: 'instance', instanceId: 'bi.1' }

const MODIFIER: BuffModifierPayload = {
  id: 'mod.1',
  channel: 'potency',
  operation: 'add',
  value: 1,
  reapply: 'replace',
  priority: 0,
  lifetime: { type: 'buff_lifetime' },
}

interface PortCall {
  method: string
  args: readonly unknown[]
  ctx: CombatAuthorityExecutionContext
}

function makePorts(): { ports: Required<CombatAuthorityPorts>; calls: PortCall[] } {
  const calls: PortCall[] = []
  const rec =
    <R>(method: string, result: R) =>
    (...args: unknown[]): R => {
      const ctx = args[args.length - 1] as CombatAuthorityExecutionContext
      calls.push({ method, args: args.slice(0, -1), ctx })
      return result
    }

  const buffs: BuffAuthority = {
    apply: rec('buffs.apply', { applied: true, instanceId: 'bi.1' }),
    addStacks: rec('buffs.addStacks', { stacksBefore: 1, stacksAfter: 3 }),
    removeStacks: rec('buffs.removeStacks', { stacksBefore: 3, stacksAfter: 1 }),
    consumeStacks: rec('buffs.consumeStacks', {
      consumed: 2,
      remaining: 0,
      removed: true,
    }),
    addModifier: rec('buffs.addModifier', { applied: true }),
    removeModifier: rec('buffs.removeModifier', { removed: true }),
    refreshDuration: rec('buffs.refreshDuration', {
      durationBefore: 1,
      durationAfter: 3,
    }),
    extendDuration: rec('buffs.extendDuration', {
      durationBefore: 1,
      durationAfter: 4,
    }),
    triggerPeriodic: rec('buffs.triggerPeriodic', []),
    remove: rec('buffs.remove', undefined),
  }
  const damage: DamageAuthority = {
    dealDamage: rec('damage.dealDamage', {
      rawDamage: 12,
      hpDamage: 9,
      killed: false,
    }),
  }
  const gauge: GaugeAuthority = {
    pushGauge: rec('gauge.pushGauge', {
      before: 0.2,
      requestedDelta: 0.35,
      appliedDelta: 0.35,
      after: 0.55,
    }),
  }
  const resource: ResourceAuthority = {
    gain: rec('resource.gain', { before: 0, requested: 10, applied: 10, after: 10 }),
    consume: rec('resource.consume', {
      before: 10,
      requested: 3,
      applied: 3,
      after: 7,
    }),
  }
  const shield: ShieldAuthority = {
    applyShield: rec('shield.applyShield', { applied: 40, shieldAfter: 40 }),
  }
  const heal: HealAuthority = {
    heal: rec('heal.heal', { requested: 7, healed: 7, after: 20 }),
  }

  return { ports: { buffs, damage, gauge, resource, shield, heal }, calls }
}

function makeSink(): { sink: CombatEventSink; emitted: CombatEventPayload[] } {
  const emitted: CombatEventPayload[] = []
  return { sink: { emit: (e) => void emitted.push(e) }, emitted }
}

function op(base: {
  operationId: string
  type: ResolvedCombatOperation['type']
  payload: ResolvedCombatOperation['payload']
}): ResolvedCombatOperation {
  return { ...base, origin: ORIGIN } as ResolvedCombatOperation
}

describe('CombatOperationExecutor routing', () => {
  it('routes deal_damage to damage port with payload + ctx', () => {
    const { ports, calls } = makePorts()
    const { sink } = makeSink()
    const payload: DealDamageOperation['payload'] = {
      targetId: 'entity.b',
      element: 'fire',
      damageProfile: 'test',
      coefficient: 2,
      hitCount: 1,
      canCrit: false,
      canMiss: false,
    }
    const executor = new CombatOperationExecutor(ports)
    const result = executor.execute(
      op({ operationId: 'op.1', type: 'deal_damage', payload }),
      sink,
    )

    expect(calls).toHaveLength(1)
    expect(calls[0]?.method).toBe('damage.dealDamage')
    expect(calls[0]?.args[0]).toEqual(payload)
    expect(calls[0]?.ctx.operationId).toBe('op.1')
    expect(calls[0]?.ctx.origin).toBe(ORIGIN)
    expect(calls[0]?.ctx.events).toBe(sink)
    expect(result).toEqual({
      operationId: 'op.1',
      type: 'deal_damage',
      status: 'resolved',
      damage: { rawDamage: 12, hpDamage: 9, killed: false },
    })
  })

  it('routes every buff op type to the buffs port exactly once', () => {
    const { ports, calls } = makePorts()
    const { sink } = makeSink()
    const executor = new CombatOperationExecutor(ports)

    const cases: { op: ResolvedCombatOperation; method: string }[] = [
      {
        op: op({
          operationId: 'op.apply',
          type: 'apply_buff',
          payload: {
            definitionId: 'def.x',
            targetId: 'entity.b',
            stacks: 2,
            baseChance: 0.8,
            reactionEligibility: 'eligible',
          },
        }),
        method: 'buffs.apply',
      },
      {
        op: op({
          operationId: 'op.add',
          type: 'add_buff_stacks',
          payload: { selector: SELECTOR, stacks: 2 },
        }),
        method: 'buffs.addStacks',
      },
      {
        op: op({
          operationId: 'op.rm',
          type: 'remove_buff_stacks',
          payload: { selector: SELECTOR, stacks: 1 },
        }),
        method: 'buffs.removeStacks',
      },
      {
        op: op({
          operationId: 'op.consume',
          type: 'consume_buff_stacks',
          payload: { selector: SELECTOR, stacks: 'all', removalReason: 'reaction' },
        }),
        method: 'buffs.consumeStacks',
      },
      {
        op: op({
          operationId: 'op.addmod',
          type: 'add_buff_modifier',
          payload: { selector: SELECTOR, modifier: MODIFIER },
        }),
        method: 'buffs.addModifier',
      },
      {
        op: op({
          operationId: 'op.rmmod',
          type: 'remove_buff_modifier',
          payload: { selector: SELECTOR, modifierId: 'mod.1' },
        }),
        method: 'buffs.removeModifier',
      },
      {
        op: op({
          operationId: 'op.refresh',
          type: 'refresh_buff_duration',
          payload: { selector: SELECTOR, duration: 3 },
        }),
        method: 'buffs.refreshDuration',
      },
      {
        op: op({
          operationId: 'op.extend',
          type: 'extend_buff_duration',
          payload: { selector: SELECTOR, turns: 2, maxRemaining: 5 },
        }),
        method: 'buffs.extendDuration',
      },
      {
        op: op({
          operationId: 'op.periodic',
          type: 'trigger_buff_periodic',
          payload: { selector: SELECTOR, periodicId: 'tick' },
        }),
        method: 'buffs.triggerPeriodic',
      },
      {
        op: op({
          operationId: 'op.remove',
          type: 'remove_buff',
          payload: { selector: SELECTOR, removalReason: 'cleansed' },
        }),
        method: 'buffs.remove',
      },
    ]

    for (const c of cases) {
      calls.length = 0
      const result = executor.execute(c.op, sink)
      expect(calls.map((x) => x.method)).toEqual([c.method])
      expect(calls[0]?.ctx.operationId).toBe(c.op.operationId)
      expect(calls[0]?.ctx.origin).toBe(ORIGIN)
      expect(result.operationId).toBe(c.op.operationId)
      expect(result.type).toBe(c.op.type)
      expect(result.status).toBe('resolved')
    }
  })

  it('routes gauge/resource/shield/heal ops to their ports', () => {
    const { ports, calls } = makePorts()
    const { sink } = makeSink()
    const executor = new CombatOperationExecutor(ports)

    const cases: { op: ResolvedCombatOperation; method: string }[] = [
      {
        op: op({
          operationId: 'op.gauge',
          type: 'push_gauge',
          payload: { targetId: 'entity.a', fractionOfMax: 0.35 },
        }),
        method: 'gauge.pushGauge',
      },
      {
        op: op({
          operationId: 'op.gain',
          type: 'gain_resource',
          payload: { targetId: 'entity.a', resourceId: 'the', amount: 10 },
        }),
        method: 'resource.gain',
      },
      {
        op: op({
          operationId: 'op.consume',
          type: 'consume_resource',
          payload: { targetId: 'entity.a', resourceId: 'the', amount: 3 },
        }),
        method: 'resource.consume',
      },
      {
        op: op({
          operationId: 'op.shield',
          type: 'apply_shield',
          payload: { targetId: 'entity.a', amount: 40 },
        }),
        method: 'shield.applyShield',
      },
      {
        op: op({
          operationId: 'op.heal',
          type: 'heal',
          payload: { targetId: 'entity.a', amount: 7 },
        }),
        method: 'heal.heal',
      },
    ]

    for (const c of cases) {
      calls.length = 0
      const result = executor.execute(c.op, sink)
      expect(calls.map((x) => x.method)).toEqual([c.method])
      expect(result.status).toBe('resolved')
    }
  })

  it('forwards consume_resource valueSource to the resource port (P5 F-B)', () => {
    const { ports, calls } = makePorts()
    const { sink } = makeSink()
    const executor = new CombatOperationExecutor(ports)

    executor.execute(
      op({
        operationId: 'op.consume',
        type: 'consume_resource',
        payload: {
          targetId: 'entity.a',
          resourceId: 'the',
          amount: 3,
          valueSource: 'cast_snapshot',
        },
      }),
      sink,
    )

    expect(calls[0]?.method).toBe('resource.consume')
    expect(calls[0]?.args).toEqual(['entity.a', 'the', 3, 'cast_snapshot'])
  })

  it('composes ApplyBuffRequest from payload + origin envelope (r2 HIGH 3)', () => {
    const { ports, calls } = makePorts()
    const { sink } = makeSink()
    const executor = new CombatOperationExecutor(ports)

    executor.execute(
      op({
        operationId: 'op.apply',
        type: 'apply_buff',
        payload: {
          definitionId: 'def.x',
          targetId: 'entity.b',
          stacks: 2,
          baseChance: 0.8,
          reactionEligibility: 'suppressed',
        },
      }),
      sink,
    )

    expect(calls[0]?.args[0]).toEqual({
      definitionId: 'def.x',
      targetId: 'entity.b',
      stacks: 2,
      baseChance: 0.8,
      reactionEligibility: 'suppressed',
      sourceId: 'entity.a',
      origin: ORIGIN,
    })
  })

  it('populates typed result payloads (push_gauge before/after)', () => {
    const { ports } = makePorts()
    const { sink } = makeSink()
    const executor = new CombatOperationExecutor(ports)

    const result = executor.execute(
      op({
        operationId: 'op.gauge',
        type: 'push_gauge',
        payload: { targetId: 'entity.a', fractionOfMax: 0.35 },
      }),
      sink,
    )

    expect(result.type).toBe('push_gauge')
    if (result.type !== 'push_gauge') throw new Error('narrow')
    expect(result.result).toEqual({
      before: 0.2,
      requestedDelta: 0.35,
      appliedDelta: 0.35,
      after: 0.55,
    })
  })

  it('maps trigger_buff_periodic resolutions to resolutionsEmitted', () => {
    const { ports } = makePorts()
    ports.buffs.triggerPeriodic = () => [
      { requests: [] },
      { requests: [] },
    ]
    const { sink } = makeSink()
    const executor = new CombatOperationExecutor(ports)

    const result = executor.execute(
      op({
        operationId: 'op.tp',
        type: 'trigger_buff_periodic',
        payload: { selector: SELECTOR },
      }),
      sink,
    )

    if (result.type !== 'trigger_buff_periodic') throw new Error('narrow')
    expect(result.result).toEqual({ resolutionsEmitted: 2 })
  })

  it('missing port throws a structural fault, never a failed result', () => {
    const { sink } = makeSink()
    const executor = new CombatOperationExecutor({ damage: makePorts().ports.damage })

    expect(() =>
      executor.execute(
        op({
          operationId: 'op.heal',
          type: 'heal',
          payload: { targetId: 'entity.a', amount: 1 },
        }),
        sink,
      ),
    ).toThrow(CombatSettlementFault)

    const empty = new CombatOperationExecutor({})
    expect(() =>
      empty.execute(
        op({
          operationId: 'op.d',
          type: 'deal_damage',
          payload: {
            targetId: 'e',
            damageProfile: 'p',
            coefficient: 1,
            hitCount: 1,
            canCrit: false,
            canMiss: false,
          },
        }),
        sink,
      ),
    ).toThrow(CombatSettlementFault)
  })

  it('converts a CombatOperationSkip into a typed skipped result (sec.51)', () => {
    const { ports } = makePorts()
    ports.damage.dealDamage = () => {
      throw new CombatOperationSkip('invalid_target_state')
    }
    const { sink } = makeSink()
    const executor = new CombatOperationExecutor(ports)

    const result = executor.execute(
      op({
        operationId: 'op.d',
        type: 'deal_damage',
        payload: {
          targetId: 'e',
          damageProfile: 'p',
          coefficient: 1,
          hitCount: 1,
          canCrit: false,
          canMiss: false,
        },
      }),
      sink,
    )

    expect(result).toEqual({
      operationId: 'op.d',
      type: 'deal_damage',
      status: 'skipped',
      reason: 'invalid_target_state',
    })
  })

  it('does not swallow arbitrary authority errors', () => {
    const { ports } = makePorts()
    ports.damage.dealDamage = () => {
      throw new Error('boom')
    }
    const { sink } = makeSink()
    const executor = new CombatOperationExecutor(ports)

    expect(() =>
      executor.execute(
        op({
          operationId: 'op.d',
          type: 'deal_damage',
          payload: {
            targetId: 'e',
            damageProfile: 'p',
            coefficient: 1,
            hitCount: 1,
            canCrit: false,
            canMiss: false,
          },
        }),
        sink,
      ),
    ).toThrow('boom')
  })
})
