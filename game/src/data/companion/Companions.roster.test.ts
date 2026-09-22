import { describe, expect, it } from 'vitest'
import { BETA_COMPANION_IDS, BETA_COMPANIONS, COMPANIONS } from './Companions'
import type { CompanionDefinition } from './Companions'
import { ITEM_GRADE_ORDER } from '@/core/item/ItemGrade'
import type { ItemGrade } from '@/core/item/ItemGrade'
import { REALMS } from '@/data/realms/realm'
import { MAX_CONSTELLATION_RANK } from '@/core/companion/CompanionProgression'
import { COMPANION_BASE_RATES, effectiveCompanionRates } from '@/core/companion/CompanionGacha'
import { BUFF_REGISTRY } from '@/data/buff/BuffRegistry'
import type { TurnSkillDefinition } from '@/core/battle/turn/TurnSkillAction'

// MVP roster invariants (companion-gacha Task 11, 2026-09-12): the pool
// shape the gacha ops layer assumes, realm gates that can actually be
// reached, and registry references that resolve at battle time
// (BUFF_REGISTRY.get throws on an unknown id mid-battle).

const GATED_SLOTS = ['special', 'ultimate'] as const

const PERK_RANKS = [2, 4, 6] as const

function skillsOf(definition: CompanionDefinition): TurnSkillDefinition[] {
  return [definition.basic, definition.special, definition.ultimate].filter(
    (skill): skill is TurnSkillDefinition => skill !== undefined,
  )
}

describe('COMPANIONS roster shape', () => {
  it('has exactly 12 definitions with grade counts 4/4/3/1/0 (M-G: +than_nong huyen, +khai_minh dia)', () => {
    expect(COMPANIONS).toHaveLength(12)

    const counts: Record<ItemGrade, number> = { hoang: 0, huyen: 0, dia: 0, thien: 0, tien: 0 }

    for (const definition of COMPANIONS) {
      counts[definition.grade] += 1
    }

    expect(counts).toEqual({ hoang: 4, huyen: 4, dia: 3, thien: 1, tien: 0 })
  })

  it('every definition id and every skill id is unique', () => {
    const definitionIds = COMPANIONS.map((definition) => definition.id)
    const skillIds = COMPANIONS.flatMap((definition) => skillsOf(definition).map((skill) => skill.id))

    expect(new Set(definitionIds).size).toBe(definitionIds.length)
    expect(new Set(skillIds).size).toBe(skillIds.length)
  })

  it('every definition has a basic with targeting and a non-negative cooldown', () => {
    for (const definition of COMPANIONS) {
      expect(definition.basic.targeting, `${definition.id}.basic.targeting`).toBeDefined()
      expect(definition.basic.targeting.shape, `${definition.id}.basic.targeting.shape`).toBeTruthy()
      expect(Number.isInteger(definition.basic.cooldownTurns)).toBe(true)
      expect(definition.basic.cooldownTurns).toBeGreaterThanOrEqual(0)
    }
  })

  it('growthRate matches the per-grade balance constant', () => {
    const expected: Partial<Record<ItemGrade, number>> = {
      hoang: 0.04,
      huyen: 0.05,
      dia: 0.06,
      thien: 0.08,
    }

    for (const definition of COMPANIONS) {
      expect(definition.growthRate, `${definition.id}.growthRate`).toBe(expected[definition.grade])
    }
  })
})

describe('COMPANIONS unlock thresholds', () => {
  it('a special/ultimate threshold implies the skill exists - and vice versa (no dead content)', () => {
    for (const definition of COMPANIONS) {
      for (const slot of GATED_SLOTS) {
        // Threshold without a skill is misleading; skill without a
        // threshold can never unlock (isCompanionSkillUnlocked).
        expect(Boolean(definition[slot]), `${definition.id}.${slot}`).toBe(
          Boolean(definition.unlockThresholds[slot]),
        )
      }
    }
  })

  it('thresholds reference valid realms with a reachable tier', () => {
    const realmById = new Map(REALMS.map((realm) => [realm.id, realm]))

    for (const definition of COMPANIONS) {
      for (const slot of GATED_SLOTS) {
        const threshold = definition.unlockThresholds[slot]

        if (!threshold) {
          continue
        }

        const realm = realmById.get(threshold.realmId)

        expect(realm, `${definition.id}.${slot} realmId "${threshold.realmId}"`).toBeDefined()
        expect(threshold.realmLevel).toBeGreaterThanOrEqual(1)
        expect(threshold.realmLevel).toBeLessThanOrEqual(realm!.maxLevel)
      }
    }
  })
})

describe('COMPANIONS constellation perks', () => {
  it('atRank stays inside {2,4,6} and never exceeds MAX_CONSTELLATION_RANK', () => {
    for (const definition of COMPANIONS) {
      for (const perk of definition.constellationPerks ?? []) {
        expect(PERK_RANKS, `${definition.id} perk atRank ${perk.atRank}`).toContain(perk.atRank)
        expect(perk.atRank).toBeLessThanOrEqual(MAX_CONSTELLATION_RANK)
      }
    }
  })

  it('dia and thien definitions carry perks at exactly ranks 2/4/6', () => {
    for (const definition of COMPANIONS.filter((entry) => entry.grade === 'dia' || entry.grade === 'thien')) {
      expect(
        (definition.constellationPerks ?? []).map((perk) => perk.atRank).sort(),
        `${definition.id} constellationPerks`,
      ).toEqual([2, 4, 6])
    }
  })

  it('skill_override perks only reference declared skill slots', () => {
    for (const definition of COMPANIONS) {
      for (const perk of definition.constellationPerks ?? []) {
        if (perk.kind !== 'skill_override') {
          continue
        }

        // resolveCompanionSkillKit applies overrides to kit[perk.slot] -
        // an undeclared slot would silently no-op.
        expect(definition[perk.slot], `${definition.id} perk slot "${perk.slot}"`).toBeDefined()
      }
    }
  })
})

describe('COMPANIONS skill content resolves', () => {
  it('every appliesAilment/appliesBuff id exists in BUFF_REGISTRY', () => {
    for (const definition of COMPANIONS) {
      for (const skill of skillsOf(definition)) {
        const ailments = skill.appliesAilments ?? (skill.appliesAilment ? [skill.appliesAilment] : [])

        for (const ailment of ailments) {
          expect(
            () => BUFF_REGISTRY.get(ailment.buffDefinitionId),
            `${definition.id}/${skill.id} ailment "${ailment.buffDefinitionId}"`,
          ).not.toThrow()
          expect(ailment.chance).toBeGreaterThan(0)
          expect(ailment.chance).toBeLessThanOrEqual(1)
        }

        for (const application of skill.appliesBuffs ?? []) {
          expect(
            () => BUFF_REGISTRY.get(application.definitionId),
            `${definition.id}/${skill.id} buff "${application.definitionId}"`,
          ).not.toThrow()
        }
      }
    }
  })

  it('every definition grade is a real ItemGrade', () => {
    for (const definition of COMPANIONS) {
      expect(ITEM_GRADE_ORDER).toContain(definition.grade)
    }
  })
})

describe('COMPANIONS gacha rates', () => {
  it('effectiveCompanionRates drops tien to 0 and renormalizes the rest', () => {
    const rates = effectiveCompanionRates(COMPANION_BASE_RATES, COMPANIONS)

    expect(rates.tien).toBe(0)

    const total = Object.values(rates).reduce((sum, rate) => sum + rate, 0)

    expect(total).toBeCloseTo(1)
    expect(rates.hoang).toBeGreaterThan(0)
    expect(rates.huyen).toBeGreaterThan(0)
    expect(rates.dia).toBeGreaterThan(0)
    expect(rates.thien).toBeGreaterThan(0)
  })
})

// P7-M-G (beta companion roster): the catalog keeps all 12 definitions
// resolvable (owned instances, save validation, combat build, art), but
// the Beta-ACQUIRABLE pool is exactly {than_nong, khai_minh} — the
// existing ten are "future content" per the mission graph.
describe('BETA_COMPANIONS pool (P7-M-G)', () => {
  it('is exactly than_nong + khai_minh, in catalog order', () => {
    expect(BETA_COMPANION_IDS).toEqual(['than_nong', 'khai_minh'])
    expect(BETA_COMPANIONS.map((definition) => definition.id)).toEqual(['than_nong', 'khai_minh'])
  })

  it('every beta definition is the SAME object in the catalog (derived, never duplicated)', () => {
    for (const beta of BETA_COMPANIONS) {
      expect(COMPANIONS).toContain(beta)
    }
    expect(BETA_COMPANIONS.length).toBe(BETA_COMPANION_IDS.length)
  })

  it('beta effective rates renormalize the present grades to {huyen: 2/3, dia: 1/3}', () => {
    const rates = effectiveCompanionRates(COMPANION_BASE_RATES, BETA_COMPANIONS)

    expect(rates.hoang).toBe(0)
    expect(rates.huyen).toBeCloseTo(2 / 3, 5)
    expect(rates.dia).toBeCloseTo(1 / 3, 5)
    expect(rates.thien).toBe(0)
    expect(rates.tien).toBe(0)
  })
})

describe('M-G support kits', () => {
  const thanNong = COMPANIONS.find((definition) => definition.id === 'than_nong')!
  const khaiMinh = COMPANIONS.find((definition) => definition.id === 'khai_minh')!

  it('than_nong exists as a huyen healer; support skills carry no damage and target allies_except_self', () => {
    expect(thanNong).toBeDefined()
    expect(thanNong.grade).toBe('huyen')
    expect(thanNong.growthRate).toBe(0.05)

    for (const skill of [thanNong.special, thanNong.ultimate]) {
      expect(skill, 'than_nong support slot').toBeDefined()
      expect(skill!.damage, `${skill!.id} must not deal damage`).toBeUndefined()
      expect(skill!.targetScope).toBe('self')

      const allyBuffs = skill!.appliesBuffs ?? []

      expect(allyBuffs.length).toBeGreaterThan(0)
      expect(allyBuffs.every((application) => application.target === 'allies_except_self')).toBe(true)
    }
  })

  it('khai_minh exists as a dia buffer; support skills carry no damage and target allies_except_self', () => {
    expect(khaiMinh).toBeDefined()
    expect(khaiMinh.grade).toBe('dia')
    expect(khaiMinh.growthRate).toBe(0.06)

    for (const skill of [khaiMinh.special, khaiMinh.ultimate]) {
      expect(skill, 'khai_minh support slot').toBeDefined()
      expect(skill!.damage, `${skill!.id} must not deal damage`).toBeUndefined()
      expect(skill!.targetScope).toBe('self')

      const allyBuffs = skill!.appliesBuffs ?? []

      expect(allyBuffs.length).toBeGreaterThan(0)
      expect(allyBuffs.every((application) => application.target === 'allies_except_self')).toBe(true)
    }
  })

  it('khai_minh ultimate grants an external ward via the marker channel', () => {
    const wardGrant = khaiMinh.ultimate?.appliesBuffs?.find(
      (application) => application.externalWardGrant !== undefined,
    )

    expect(wardGrant).toBeDefined()
    expect(wardGrant!.externalWardGrant!.sourceMaxHpRatio).toBeGreaterThan(0)
  })

  it('khai_minh carries dia-required perks at exactly ranks 2/4/6', () => {
    expect(khaiMinh.constellationPerks?.map((perk) => perk.atRank).sort()).toEqual([2, 4, 6])
  })
})
