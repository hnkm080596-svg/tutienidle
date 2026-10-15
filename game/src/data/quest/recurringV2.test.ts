import { describe, expect, it } from 'vitest'
import { RECURRING_V2_TEMPLATES, resolveRecurringV2Objective } from './recurringV2'

describe('Thanh Van daily and weekly definitions', () => {
  it('contains seven unique templates per cadence with positive targets and rewards', () => {
    expect(RECURRING_V2_TEMPLATES.filter((item) => item.cadence === 'daily')).toHaveLength(7)
    expect(RECURRING_V2_TEMPLATES.filter((item) => item.cadence === 'weekly')).toHaveLength(7)
    expect(new Set(RECURRING_V2_TEMPLATES.map((item) => item.id)).size).toBe(14)
    for (const template of RECURRING_V2_TEMPLATES) {
      expect(template.objective.amount).toBeGreaterThan(0)
      expect(template.rewardBase.spiritStone).toBeGreaterThan(0)
      expect(template.rewardBase.cultivation).toBeGreaterThan(0)
      expect(template.requiresProducer).toContain(template.objective.kind)
    }
  })

  it('freezes D4 mortal collection or Qi alchemy at period assignment', () => {
    const d4 = RECURRING_V2_TEMPLATES.find((item) => item.id === 'tvdm2_daily_d4')!
    expect(resolveRecurringV2Objective(d4, 'mortal')).toMatchObject({
      kind: 'material_delivered', amount: 4,
      materialIdByRealm: { mortal: 'material_spirit_wood_decade' },
    })
    expect(resolveRecurringV2Objective(d4, 'qi_refining')).toEqual({
      kind: 'alchemy_crafted', amount: 1,
    })
    expect(resolveRecurringV2Objective(d4, 'foundation_establishment')).toEqual({
      kind: 'alchemy_crafted', amount: 1,
    })
    const ore = RECURRING_V2_TEMPLATES.find((item) => item.id === 'tvdm2_daily_d2')!
    expect(resolveRecurringV2Objective(ore, 'qi_refining')?.materialIdByRealm).toEqual({
      qi_refining: 'material_spirit_ore_decade',
    })
  })

  it('resolves every authored objective for every eligible realm without mutating definitions', () => {
    const before = JSON.stringify(RECURRING_V2_TEMPLATES)
    const realms = ['mortal', 'qi_refining', 'foundation_establishment'] as const
    for (const template of RECURRING_V2_TEMPLATES) {
      for (const realm of realms) {
        const objective = resolveRecurringV2Objective(template, realm)
        expect(objective, `${template.id} / ${realm}`).not.toBeNull()
        expect(objective!.amount).toBeGreaterThan(0)
        expect(template.requiresProducer).toContain(objective!.kind)
        if (objective!.materialIdByRealm) {
          expect(Object.keys(objective!.materialIdByRealm)).toEqual([realm])
          expect(objective!.materialIdByRealm![realm]).toBeTruthy()
        }
        expect(objective).not.toHaveProperty('variantsByRealm')
        const again = resolveRecurringV2Objective(template, realm)
        expect(again).toEqual(objective)
      }
    }
    expect(JSON.stringify(RECURRING_V2_TEMPLATES)).toBe(before)
  })

  it('rejects a missing realm-specific material binding', () => {
    const template = RECURRING_V2_TEMPLATES.find((item) => item.id === 'tvdm2_daily_d2')!
    const incomplete = {
      ...template,
      objective: { kind: 'material_delivered' as const, amount: 4, materialIdByRealm: { mortal: 'ore' } },
    }
    expect(resolveRecurringV2Objective(incomplete, 'qi_refining')).toBeNull()
    expect(resolveRecurringV2Objective(incomplete, 'mortal')?.materialIdByRealm).toEqual({ mortal: 'ore' })
  })
})
