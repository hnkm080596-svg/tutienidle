import { describe, expect, it } from 'vitest'
import { BUFF_REGISTRY } from './BuffRegistry'

// The Tu Reimagined (spec 2026-09-15 section 5-6, plan Task 6) — buff
// definition authoring. Holder-turn state buffs carry
// durationPolicy:'fixed_holder_turns' so a caster's own ailment stats
// can never scale them; khiem_khich stays ailment_scaled (it is a real
// debuff ON the enemy — enemy resist legitimately shortens Taunt).

describe('TheTuBuffs — registry authoring', () => {
  it('bat_tu_ba_the — 3 fixed holder-turns, clearsCcOnApply, displacementImmune marker', () => {
    const def = BUFF_REGISTRY.get('bat_tu_ba_the')

    expect(def.polarity).toBe('buff')
    expect(def.duration).toBe(3)
    expect(def.durationPolicy).toBe('fixed_holder_turns')
    expect(def.clearsCcOnApply).toBe(true)
    expect(def.effects.some((effect) => effect.type === 'marker' && effect.displacementImmune)).toBe(true)
  })

  it('phan_chinh — permanent self buff carrying a reflectsDamage reactive trigger', () => {
    const def = BUFF_REGISTRY.get('phan_chinh')

    expect(def.polarity).toBe('buff')
    expect(def.duration).toBe(Infinity)

    const reflect = def.effects.find(
      (effect) => effect.type === 'reactiveTrigger' && effect.reflectsDamage !== undefined,
    )

    expect(reflect).toBeDefined()
    expect(reflect!.type === 'reactiveTrigger' && reflect!.trigger).toBe('onImpactLanded')
    expect(reflect!.type === 'reactiveTrigger' && reflect!.reflectsDamage!.maxHpRatio).toBeGreaterThan(0)
    expect(reflect!.type === 'reactiveTrigger' && reflect!.reflectsDamage!.takenRatio).toBeGreaterThan(0)
  })

  it('son_nhac — fixed holder-turns self DR buff (finalDamageReductionPercent)', () => {
    const def = BUFF_REGISTRY.get('son_nhac')

    expect(def.polarity).toBe('buff')
    expect(def.durationPolicy).toBe('fixed_holder_turns')
    expect(def.effects).toContainEqual(
      expect.objectContaining({ type: 'statModifier', stat: 'finalDamageReductionPercent' }),
    )
  })

  it('son_nhac_ho_the — fixed holder-turns, uniquePerTarget, external-ward marker', () => {
    const def = BUFF_REGISTRY.get('son_nhac_ho_the')

    expect(def.polarity).toBe('buff')
    expect(def.durationPolicy).toBe('fixed_holder_turns')
    expect(def.uniquePerTarget).toBe(true)
    expect(def.effects.some((effect) => effect.type === 'marker' && effect.grantsExternalWard)).toBe(true)
  })

  it('khiem_khich — ailment_scaled taunt debuff, uniquePerTarget (newest taunt wins)', () => {
    const def = BUFF_REGISTRY.get('khiem_khich')

    expect(def.polarity).toBe('debuff')
    expect(def.uniquePerTarget).toBe(true)
    expect(def.durationPolicy ?? 'ailment_scaled').toBe('ailment_scaled')
    expect(def.duration).toBeGreaterThan(0)
  })

  it('an-path marker shells exist — ung_the/ho_mon/phan_mon/tro_mon permanent; tu_the/bach_ung fixed 3', () => {
    for (const id of ['ung_the', 'ho_mon', 'phan_mon', 'tro_mon']) {
      const def = BUFF_REGISTRY.get(id)

      expect(def.polarity, id).toBe('buff')
      expect(def.duration, id).toBe(Infinity)
      expect(def.hidden, id).toBe(true)
    }

    for (const id of ['tu_the', 'bach_ung']) {
      const def = BUFF_REGISTRY.get(id)

      expect(def.duration, id).toBe(3)
      expect(def.durationPolicy, id).toBe('fixed_holder_turns')
    }
  })

  it('ung_the — theEconomy marker owning the own-basic-lands income channel (single channel, P1)', () => {
    const def = BUFF_REGISTRY.get('ung_the')
    const economy = def.effects.find((effect) => effect.type === 'theEconomy')

    expect(economy).toBeDefined()
    expect(economy!.type === 'theEconomy' && economy!.gainOnBasicHit).toBe(4)
  })

  it('root markers carry their reactiveProc spec — ho intercepts, phan counters via phan_kich, tro follows via tro_kich', () => {
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
      const def = BUFF_REGISTRY.get(id)
      const procs = def.effects.filter((effect) => effect.type === 'reactiveProc')

      expect(procs.map((proc) => proc.type === 'reactiveProc' && proc.trigger), id).toEqual(
        expected.triggers,
      )

      for (const proc of procs) {
        if (proc.type !== 'reactiveProc') continue
        expect(proc.mechanic, id).toBe(expected.mechanic)
        expect(proc.chanceStat, id).toBe(expected.chanceStat)
        expect(proc.queuedAction?.payloadSkillId, id).toBe(expected.payload)
        expect(proc.queuedAction?.targetMode, id).toBe(expected.targetMode)
      }
    }
  })

  it('tu_the — reactiveEconomy procCostFlatDelta -5, fixed holder-turns', () => {
    const def = BUFF_REGISTRY.get('tu_the')
    const economy = def.effects.find((effect) => effect.type === 'reactiveEconomy')

    expect(economy).toBeDefined()
    expect(economy!.type === 'reactiveEconomy' && economy!.procCostFlatDelta).toBe(-5)
    expect(def.durationPolicy).toBe('fixed_holder_turns')
  })

  it('bach_ung — reactiveEconomy freeProcs + authored payload upgrade rider, fixed holder-turns', () => {
    const def = BUFF_REGISTRY.get('bach_ung')
    const economy = def.effects.find((effect) => effect.type === 'reactiveEconomy')

    expect(economy).toBeDefined()
    if (economy?.type !== 'reactiveEconomy') return
    expect(economy.freeProcs).toBe(true)
    // Spec-listed rider: "counter hits +break" — an ailment application on
    // the payload hit through the existing appliesAilments mechanism.
    expect(economy.payloadAilments?.length).toBeGreaterThan(0)
    expect(def.durationPolicy).toBe('fixed_holder_turns')
  })
})
