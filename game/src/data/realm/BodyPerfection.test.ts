// M-F-BODY-PERFECTION (spec S2.2, plan Step 5.1) - the authored seam
// registry: key-set === canonical REALMS ids exactly (C2C r60-f3),
// injectable validate/assert pair over FIXTURE registries (C2C r65-f2),
// authored material ids resolve in the materials catalog (C2C r60-f3),
// forward/reverse lookups. The shipped constant is intentionally
// all-empty (material identities are deferred content) - the empty
// state must still validate clean.
import { describe, expect, it } from 'vitest'
import {
  BODY_PERFECTION_REALM_MATERIALS,
  assertBodyPerfectionRegistry,
  bodyPerfectionMaterialIds,
  bodyPerfectionRealmOf,
  isBodyPerfectionMaterial,
  validateBodyPerfectionRegistry,
  type BodyPerfectionRegistry,
} from './BodyPerfection'
import { REALMS } from '../realms/realm'
import { materials } from '../materials/materials'

const REALM_IDS = REALMS.map((realm) => realm.id)

describe('BODY_PERFECTION_REALM_MATERIALS (shipped constant)', () => {
  it('keys every canonical realm exactly (C2C r60-f3 completeness)', () => {
    expect(Object.keys(BODY_PERFECTION_REALM_MATERIALS).sort())
      .toEqual([...REALM_IDS].sort())
    // Realm order preserved - row ordering in the UI reads registry order.
    expect(Object.keys(BODY_PERFECTION_REALM_MATERIALS)).toEqual(REALM_IDS)
  })

  it('ships every list empty (material identities are deferred content)', () => {
    for (const [realmId, list] of Object.entries(BODY_PERFECTION_REALM_MATERIALS)) {
      expect(list, `${realmId} must ship []`).toEqual([])
    }
    expect(validateBodyPerfectionRegistry(BODY_PERFECTION_REALM_MATERIALS)).toEqual([])
    // Module-load assert already ran on import; exercise it directly.
    expect(() => assertBodyPerfectionRegistry()).not.toThrow()
  })

  it('every authored material id resolves in the materials catalog (C2C r60-f3)', () => {
    for (const [realmId, list] of Object.entries(BODY_PERFECTION_REALM_MATERIALS)) {
      for (const materialId of list) {
        expect(
          materials.find((entry) => entry.id === materialId),
          `${realmId} authors unknown Material ${materialId}`,
        ).toBeDefined()
      }
    }
  })

  it('forward/reverse lookups stay consistent and sparse on the empty registry', () => {
    for (const realmId of REALM_IDS) {
      expect(bodyPerfectionMaterialIds(realmId)).toEqual([])
    }
    expect(bodyPerfectionMaterialIds('unknown_realm')).toBeUndefined()
    expect(bodyPerfectionRealmOf('tinh_hoa_pham_the')).toBeUndefined()
    expect(isBodyPerfectionMaterial('tinh_hoa_pham_the')).toBe(false)
    expect(isBodyPerfectionMaterial('')).toBe(false)
  })
})

describe('validateBodyPerfectionRegistry / assertBodyPerfectionRegistry (injected fixtures)', () => {
  const FIXTURE: BodyPerfectionRegistry = {
    mortal: ['bp_mortal_a'],
    qi_refining: ['bp_qi_a', 'bp_qi_b'],
    foundation_establishment: [],
    golden_core: [],
    nascent_soul: [],
    soul_transformation: [],
    void_refinement: [],
    body_integration: [],
    mahayana: [],
    tribulation: [],
  }

  it('accepts a well-formed non-empty fixture', () => {
    expect(validateBodyPerfectionRegistry(FIXTURE)).toEqual([])
    expect(() => assertBodyPerfectionRegistry(FIXTURE)).not.toThrow()
  })

  it('rejects a missing realm key', () => {
    const broken: BodyPerfectionRegistry = { ...FIXTURE }
    delete (broken as Record<string, readonly string[]>)['golden_core']

    const issues = validateBodyPerfectionRegistry(broken)
    expect(issues.some((issue) => issue.includes('golden_core'))).toBe(true)
    expect(() => assertBodyPerfectionRegistry(broken)).toThrowError(/golden_core/)
  })

  it('rejects an unknown/extra realm key', () => {
    const broken: BodyPerfectionRegistry = {
      ...FIXTURE,
      not_a_realm: ['bp_x'],
    }

    const issues = validateBodyPerfectionRegistry(broken)
    expect(issues.some((issue) => issue.includes('not_a_realm'))).toBe(true)
    expect(() => assertBodyPerfectionRegistry(broken)).toThrowError(/not_a_realm/)
  })

  it('rejects an intra-list duplicate material id', () => {
    const broken: BodyPerfectionRegistry = {
      ...FIXTURE,
      qi_refining: ['bp_qi_a', 'bp_qi_a'],
    }

    const issues = validateBodyPerfectionRegistry(broken)
    expect(issues.some((issue) => issue.includes('bp_qi_a'))).toBe(true)
    expect(() => assertBodyPerfectionRegistry(broken)).toThrowError(/bp_qi_a/)
  })

  it('rejects a material id assigned to two different realms', () => {
    const broken: BodyPerfectionRegistry = {
      ...FIXTURE,
      golden_core: ['bp_mortal_a'],
    }

    const issues = validateBodyPerfectionRegistry(broken)
    expect(issues.some((issue) => issue.includes('bp_mortal_a'))).toBe(true)
    expect(() => assertBodyPerfectionRegistry(broken)).toThrowError(/bp_mortal_a/)
  })
})
