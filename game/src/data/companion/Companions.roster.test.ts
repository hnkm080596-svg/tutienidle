import { describe, expect, it } from 'vitest'
import { COMPANIONS } from './Companions'
import type { CompanionDefinition } from './Companions'
import { ITEM_GRADE_ORDER } from '@/core/item/ItemGrade'
import type { ItemGrade } from '@/core/item/ItemGrade'
import { REALMS } from '@/data/realms/realm'
import { MAX_CONSTELLATION_RANK } from '@/core/companion/CompanionProgression'
import { COMPANION_BASE_RATES, effectiveCompanionRates } from '@/core/companion/CompanionGacha'
import { TURN_BUFF_REGISTRY } from '@/data/buff/TurnBuffRegistry'
import type { TurnSkillDefinition } from '@/core/battle/turn/TurnSkillAction'

// MVP roster invariants (companion-gacha Task 11, 2026-09-12): the pool
// shape the gacha ops layer assumes, realm gates that can actually be
// reached, and registry references that resolve at battle time
// (TURN_BUFF_REGISTRY.get throws on an unknown id mid-battle).

const GATED_SLOTS = ['special', 'ultimate'] as const

const PERK_RANKS = [2, 4, 6] as const

function skillsOf(definition: CompanionDefinition): TurnSkillDefinition[] {
  return [definition.basic, definition.special, definition.ultimate].filter(
    (skill): skill is TurnSkillDefinition => skill !== undefined,
  )
}

describe('COMPANIONS roster shape', () => {
  it('has exactly 10 definitions with grade counts 4/3/2/1/0', () => {
    expect(COMPANIONS).toHaveLength(10)

    const counts: Record<ItemGrade, number> = { hoang: 0, huyen: 0, dia: 0, thien: 0, tien: 0 }

    for (const definition of COMPANIONS) {
      counts[definition.grade] += 1
    }

    expect(counts).toEqual({ hoang: 4, huyen: 3, dia: 2, thien: 1, tien: 0 })
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
  it('every appliesAilment/appliesBuff id exists in TURN_BUFF_REGISTRY', () => {
    for (const definition of COMPANIONS) {
      for (const skill of skillsOf(definition)) {
        const ailments = skill.appliesAilments ?? (skill.appliesAilment ? [skill.appliesAilment] : [])

        for (const ailment of ailments) {
          expect(
            () => TURN_BUFF_REGISTRY.get(ailment.buffDefinitionId),
            `${definition.id}/${skill.id} ailment "${ailment.buffDefinitionId}"`,
          ).not.toThrow()
          expect(ailment.chance).toBeGreaterThan(0)
          expect(ailment.chance).toBeLessThanOrEqual(1)
        }

        if (skill.appliesBuff) {
          expect(
            () => TURN_BUFF_REGISTRY.get(skill.appliesBuff!.definitionId),
            `${definition.id}/${skill.id} buff "${skill.appliesBuff!.definitionId}"`,
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
