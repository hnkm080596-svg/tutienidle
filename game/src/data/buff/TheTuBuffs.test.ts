import { describe, expect, it } from 'vitest'
import { BUFF_REGISTRY } from './BuffRegistry'
import type { BuffDefinition } from '@/core/buff2/BuffDefinition'
import type {
  ReactiveProcPayload,
  ReactiveTriggerPayload,
} from '@/core/proc/ProcCapabilities'
import type {
  ReactiveEconomyPayload,
  TheEconomyPayload,
} from '@/core/the-tu/TheTuCapabilities'
import type { MarkerPayload } from '@/core/proc/MarkerCapabilities'

// The Tu Reimagined (spec 2026-09-15 section 5-6, plan Task 6) — buff
// definition authoring, M4 canonical shape. Holder-turn state buffs keep
// lifetime.scaling:'fixed' so a caster's own ailment stats can never
// scale them; khiem_khich stays 'ailment_scaled' (real debuff ON the
// enemy — enemy resist legitimately shortens Taunt). Effects live in
// capabilities[] now; payloads narrow via the owner-module types.

function capPayload<T>(def: BuffDefinition, type: string): T | undefined {
  const grant = (def.capabilities ?? []).find((c) => c.type === type)
  return grant === undefined ? undefined : (grant.payload as T)
}
function capsPayload<T>(def: BuffDefinition, type: string): T[] {
  return (def.capabilities ?? [])
    .filter((c) => c.type === type)
    .map((c) => c.payload as T)
}
const FIXED = { clock: 'holder_turns', scaling: 'fixed' } as const

describe('TheTuBuffs — registry authoring (buff2 shape)', () => {
  it('bat_tu_ba_the — 3 fixed holder-turns, clearsCcOnApply, displacementImmune marker grant', () => {
    const def = BUFF_REGISTRY.get('bat_tu_ba_the')

    expect(def.polarity).toBe('buff')
    expect(def.lifetime).toMatchObject({ ...FIXED, duration: 3 })
    expect(def.clearsCcOnApply).toBe(true)
    expect(capPayload<MarkerPayload>(def, 'marker')?.displacementImmune).toBe(true)
  })

  it('phan_chan — permanent self buff: Max-HP reflect with a Chấn Ấn-scoped higher marked ratio', () => {
    const def = BUFF_REGISTRY.get('phan_chan')

    expect(def.polarity).toBe('buff')
    expect(def.lifetime.clock).toBe('permanent')

    const trigger = capPayload<ReactiveTriggerPayload>(def, 'reactive_trigger')

    expect(trigger).toBeDefined()
    expect(trigger!.trigger).toBe('onImpactLanded')
    const reflect = trigger!.reflectsDamage!
    expect(reflect.maxHpRatio).toBeGreaterThan(0)
    expect(reflect.markedMaxHpRatio).toBeGreaterThan(reflect.maxHpRatio)
    expect(reflect.markedBy).toBe('chan_an')
    // Beta design: NO taken-damage ratio — the reflect is Max-HP derived only.
    expect('takenRatio' in reflect).toBe(false)
  })

  it('chan_an — mark-only ailment debuff: no DoT, no stat-down, dispellable', () => {
    const def = BUFF_REGISTRY.get('chan_an')

    expect(def.polarity).toBe('debuff')
    expect(def.instanceScope).toBe('per_target')
    expect(def.sourceOwnership).toBe('latest')
    expect(def.lifetime.scaling).toBe('ailment_scaled')
    expect(def.application?.resistance).toBe('ailment')
    expect(def.statModifiers ?? []).toHaveLength(0)
    expect(def.dispellable).toBe(true)
  })

  it('tran_kinh — short ailment weakening the next damage hit (finalDamagePercent cut)', () => {
    const def = BUFF_REGISTRY.get('tran_kinh')

    expect(def.polarity).toBe('debuff')
    expect(def.lifetime.duration).toBeGreaterThan(0)
    expect(def.statModifiers).toContainEqual(
      expect.objectContaining({ stat: 'finalDamagePercent', flat: expect.any(Number) }),
    )
    const cut = def.statModifiers!.find((m) => m.stat === 'finalDamagePercent')!.flat!
    expect(cut).toBeLessThan(0)
  })

  it('son_nhac — fixed holder-turns self DR buff (finalDamageReductionPercent)', () => {
    const def = BUFF_REGISTRY.get('son_nhac')

    expect(def.polarity).toBe('buff')
    expect(def.lifetime.scaling).toBe('fixed')
    expect(def.statModifiers).toContainEqual(
      expect.objectContaining({ stat: 'finalDamageReductionPercent' }),
    )
  })

  it('son_nhac_ho_the — fixed holder-turns, per_target+latest, external-ward marker grant', () => {
    const def = BUFF_REGISTRY.get('son_nhac_ho_the')

    expect(def.polarity).toBe('buff')
    expect(def.lifetime.scaling).toBe('fixed')
    expect(def.instanceScope).toBe('per_target')
    expect(def.sourceOwnership).toBe('latest')
    expect(capPayload<MarkerPayload>(def, 'marker')?.grantsExternalWard).toBe(true)
  })

  it('khiem_khich — ailment_scaled taunt debuff, per_target+latest (newest taunt wins)', () => {
    const def = BUFF_REGISTRY.get('khiem_khich')

    expect(def.polarity).toBe('debuff')
    expect(def.instanceScope).toBe('per_target')
    expect(def.sourceOwnership).toBe('latest')
    expect(def.lifetime.scaling).toBe('ailment_scaled')
    expect(def.lifetime.duration).toBeGreaterThan(0)
    expect(def.application?.resistance).toBe('ailment')
  })

  it('an-path marker shells exist — ung_the/ho_mon/phan_mon/tro_mon permanent; tu_the/bach_ung fixed 3', () => {
    for (const id of ['ung_the', 'ho_mon', 'phan_mon', 'tro_mon']) {
      const def = BUFF_REGISTRY.get(id)

      expect(def.polarity, id).toBe('buff')
      expect(def.lifetime.clock, id).toBe('permanent')
      expect(def.hidden, id).toBe(true)
      expect(def.kind, id).toBe('marker')
    }

    for (const id of ['tu_the', 'bach_ung']) {
      const def = BUFF_REGISTRY.get(id)

      expect(def.lifetime, id).toMatchObject({ ...FIXED, duration: 3 })
    }
  })

  it('ung_the — the_economy grant owning the own-basic-lands income channel (single channel, P1)', () => {
    const economy = capPayload<TheEconomyPayload>(BUFF_REGISTRY.get('ung_the'), 'the_economy')

    expect(economy).toBeDefined()
    expect(economy!.gainOnBasicHit).toBe(4)
  })

  it('root markers carry their reactive_proc grants — ho intercepts, phan counters via phan_kich, tro follows via tro_kich', () => {
    const specs: Record<
      string,
      { triggers: string[]; mechanic: string; chanceStat: string; payload?: string; targetMode?: string }
    > = {
      ho_mon: { triggers: ['onAllyTargeted'], mechanic: 'intercept', chanceStat: 'protectChance' },
      phan_mon: {
        triggers: ['onImpactLanded', 'onEvade'],
        mechanic: 'counter',
        chanceStat: 'counterChance',
        payload: 'phan_kich',
        targetMode: 'attacker',
      },
      tro_mon: {
        triggers: ['onAllyActionComplete'],
        mechanic: 'follow_up',
        chanceStat: 'followUpChance',
        payload: 'tro_kich',
        targetMode: 'triggering_targets',
      },
    }

    for (const [id, expected] of Object.entries(specs)) {
      const procs = capsPayload<ReactiveProcPayload>(BUFF_REGISTRY.get(id), 'reactive_proc')

      expect(procs.map((p) => p.trigger), id).toEqual(expected.triggers)

      for (const proc of procs) {
        expect(proc.mechanic, id).toBe(expected.mechanic)
        expect(proc.chanceStat, id).toBe(expected.chanceStat)
        expect(proc.queuedAction?.payloadSkillId, id).toBe(expected.payload)
        expect(proc.queuedAction?.targetMode, id).toBe(expected.targetMode)
      }
    }
  })

  it('tu_the — reactive_economy procCostFlatDelta -5, fixed holder-turns', () => {
    const def = BUFF_REGISTRY.get('tu_the')
    const economy = capPayload<ReactiveEconomyPayload>(def, 'reactive_economy')

    expect(economy).toBeDefined()
    expect(economy!.procCostFlatDelta).toBe(-5)
    expect(def.lifetime.scaling).toBe('fixed')
  })

  it('bach_ung — reactive_economy freeProcs + authored payload upgrade rider, fixed holder-turns', () => {
    const def = BUFF_REGISTRY.get('bach_ung')
    const economy = capPayload<ReactiveEconomyPayload>(def, 'reactive_economy')

    expect(economy).toBeDefined()
    expect(economy!.freeProcs).toBe(true)
    // Spec-listed rider: "counter hits +break" — an ailment application on
    // the payload hit through the existing appliesAilments mechanism.
    expect(economy!.payloadAilments?.length).toBeGreaterThan(0)
    expect(def.lifetime.scaling).toBe('fixed')
  })
})
