// M-F-BODY-PERFECTION (spec S3/S4/S5, plan Step 5.2) - domain arms on
// vi.mock'd FIXTURE registries (C2C r65-f1): the shipped all-empty
// registry only exercises the fail-closed arm; positive arms run here
// against mortal 1 / LQ 2 / TC 3 / KD 4 fixture lists.
import { describe, expect, it, vi } from 'vitest'
import type { PlayerData } from '../../player/Player'

// Fixture: mortal 1, qi_refining 2, foundation_establishment 3,
// golden_core 4 materials - the ruling's authored shape. Real catalog
// ids are unnecessary at this layer (domain never resolves Materials).
const { FIXTURE } = vi.hoisted(() => {
  const FIXTURE: Record<string, readonly string[]> = {
  mortal: ['bp_mortal_a'],
  qi_refining: ['bp_qi_a', 'bp_qi_b'],
  foundation_establishment: ['bp_tc_a', 'bp_tc_b', 'bp_tc_c'],
  golden_core: ['bp_kd_a', 'bp_kd_b', 'bp_kd_c', 'bp_kd_d'],
  nascent_soul: [],
  soul_transformation: [],
  void_refinement: [],
  body_integration: [],
  mahayana: [],
  tribulation: [],
}
  return { FIXTURE }
})

vi.mock('../../../data/realm/BodyPerfection', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../data/realm/BodyPerfection')>()

  const byRealm = new Map(Object.entries(FIXTURE).map(([realm, ids]) => [realm, ids]))
  const realmOf = new Map<string, string>()
  for (const [realm, ids] of byRealm) {
    for (const id of ids) {
      realmOf.set(id, realm)
    }
  }

  return {
    ...actual,
    BODY_PERFECTION_REALM_MATERIALS: FIXTURE,
    bodyPerfectionMaterialIds: (realmId: string) => byRealm.get(realmId) ?? [],
    bodyPerfectionRealmOf: (materialId: string) => realmOf.get(materialId),
    isBodyPerfectionMaterial: (materialId: string) => realmOf.has(materialId),
  }
})

import { createDefaultPlayer } from '../../player/Player'
import {
  applyBodyPerfection,
  assertBodyPerfectionIntegrity,
  canPerfectBodyRealm,
  createDefaultBodyPerfection,
  getBodyPerfectionMultiplier,
  getBodyPerfectionRealmProgress,
  isBodyPerfectionRevealed,
  recordBodyPerfectionMaterialDiscovery,
  validateBodyPerfectionPersistedState,
  type BodyPerfectionRealmProgress,
} from './BodyPerfection'

function player(partial?: (p: PlayerData) => void): PlayerData {
  const p = createDefaultPlayer()
  partial?.(p)
  return p
}

const ownedOf =
  (owned: Record<string, number>) =>
  (id: string) =>
    owned[id] ?? 0

describe('recordBodyPerfectionMaterialDiscovery / reveal flag', () => {
  it('writes the marker once on first delivery, idempotent on repeat', () => {
    const p = player()

    expect(recordBodyPerfectionMaterialDiscovery(p, 'bp_mortal_a')).toBe(true)
    expect(recordBodyPerfectionMaterialDiscovery(p, 'bp_mortal_a')).toBe(false)
    expect(p.bodyPerfection.discoveredMaterials).toEqual(['bp_mortal_a'])
  })

  it('ignores non-perfection material ids (no-op, no write)', () => {
    const p = player()

    expect(recordBodyPerfectionMaterialDiscovery(p, 'tinh_hoa_pham_the')).toBe(false)
    expect(recordBodyPerfectionMaterialDiscovery(p, 'spirit_stone')).toBe(false)
    expect(p.bodyPerfection.discoveredMaterials).toEqual([])
  })

  it('records future-realm materials early (discovery is realm-agnostic)', () => {
    const p = player((s) => {
      s.realmId = 'mortal'
    })

    expect(recordBodyPerfectionMaterialDiscovery(p, 'bp_kd_a')).toBe(true)
    expect(p.bodyPerfection.discoveredMaterials).toEqual(['bp_kd_a'])
  })

  it('reveals the surface only after the first discovery', () => {
    const p = player()

    expect(isBodyPerfectionRevealed(p)).toBe(false)
    recordBodyPerfectionMaterialDiscovery(p, 'bp_mortal_a')
    expect(isBodyPerfectionRevealed(p)).toBe(true)
  })

  it('keeps the marker after the material is consumed (persist-independent)', () => {
    const p = player()
    recordBodyPerfectionMaterialDiscovery(p, 'bp_mortal_a')

    // Consumption never rewrites discoveredMaterials - apply marks the
    // realm and the discovery bit stays set.
    applyBodyPerfection(p, 'mortal')
    expect(p.bodyPerfection.discoveredMaterials).toEqual(['bp_mortal_a'])
    expect(p.bodyPerfection.perfectedRealmIds).toEqual(['mortal'])
  })
})

describe('canPerfectBodyRealm arms', () => {
  it('fails closed on an empty authored list', () => {
    const p = player((s) => {
      s.realmId = 'mahayana'
    })

    expect(canPerfectBodyRealm(p, 'mahayana', () => 99)).toBe(false)
    expect(canPerfectBodyRealm(p, 'unknown_realm', () => 99)).toBe(false)
  })

  it('rejects an unreached (future) realm even fully stocked', () => {
    const p = player((s) => {
      s.realmId = 'mortal'
      recordBodyPerfectionMaterialDiscovery(s, 'bp_qi_a')
      recordBodyPerfectionMaterialDiscovery(s, 'bp_qi_b')
    })

    expect(canPerfectBodyRealm(p, 'qi_refining', ownedOf({ bp_qi_a: 1, bp_qi_b: 1 }))).toBe(false)
  })

  it('rejects an already-perfected realm', () => {
    const p = player((s) => {
      recordBodyPerfectionMaterialDiscovery(s, 'bp_mortal_a')
      applyBodyPerfection(s, 'mortal')
    })

    expect(canPerfectBodyRealm(p, 'mortal', ownedOf({ bp_mortal_a: 1 }))).toBe(false)
  })

  it('rejects when a required material is not owned', () => {
    const p = player((s) => {
      recordBodyPerfectionMaterialDiscovery(s, 'bp_qi_a')
      recordBodyPerfectionMaterialDiscovery(s, 'bp_qi_b')
      s.realmId = 'qi_refining'
    })

    expect(canPerfectBodyRealm(p, 'qi_refining', ownedOf({ bp_qi_a: 1 }))).toBe(false)
    expect(canPerfectBodyRealm(p, 'qi_refining', ownedOf({ bp_qi_a: 0, bp_qi_b: 0 }))).toBe(false)
  })

  it('rejects owned-but-undiscovered required materials (C2C r60-f1)', () => {
    // A legal save can hold a required material with no discovery bit -
    // inventory is NOT canonical discovery. The gate must fail, not
    // let apply() mint a perfected realm whose authored list is not
    // a subset of discoveredMaterials (integrity would then reject
    // the very state the transaction produced).
    const p = player((s) => {
      s.realmId = 'mortal'
      // No discovery recorded for bp_mortal_a.
    })

    expect(canPerfectBodyRealm(p, 'mortal', ownedOf({ bp_mortal_a: 5 }))).toBe(false)
  })

  it('accepts a fully gated realm (discovered + owned + reached)', () => {
    const p = player((s) => {
      s.realmId = 'qi_refining'
      recordBodyPerfectionMaterialDiscovery(s, 'bp_qi_a')
      recordBodyPerfectionMaterialDiscovery(s, 'bp_qi_b')
    })

    expect(canPerfectBodyRealm(p, 'qi_refining', ownedOf({ bp_qi_a: 1, bp_qi_b: 1 }))).toBe(true)
  })
})

describe('applyBodyPerfection / multiplier', () => {
  it('write-if-absent: re-mark is a no-op', () => {
    const p = player()

    applyBodyPerfection(p, 'mortal')
    applyBodyPerfection(p, 'mortal')
    expect(p.bodyPerfection.perfectedRealmIds).toEqual(['mortal'])
  })

  it('scales +10pp additively per perfected realm', () => {
    const p = player()
    expect(getBodyPerfectionMultiplier(p)).toBe(1)

    applyBodyPerfection(p, 'mortal')
    expect(getBodyPerfectionMultiplier(p)).toBeCloseTo(1.1)

    applyBodyPerfection(p, 'qi_refining')
    applyBodyPerfection(p, 'foundation_establishment')
    expect(getBodyPerfectionMultiplier(p)).toBeCloseTo(1.3)
  })
})

describe('getBodyPerfectionRealmProgress (read model)', () => {
  it('emits one row per realm with >=1 discovered id, canonical order', () => {
    const p = player((s) => {
      s.realmId = 'foundation_establishment'
      // Discovery order deliberately scrambles realm order - rows must
      // still emit in registry (realm) order.
      recordBodyPerfectionMaterialDiscovery(s, 'bp_kd_b') // future
      recordBodyPerfectionMaterialDiscovery(s, 'bp_mortal_a')
      recordBodyPerfectionMaterialDiscovery(s, 'bp_tc_c') // partial
      applyBodyPerfection(s, 'mortal')
    })

    const rows = getBodyPerfectionRealmProgress(p)
    expect(rows.map((row) => row.realmId)).toEqual(['mortal', 'foundation_establishment', 'golden_core'])

    const mortal = rows[0]!
    expect(mortal).toMatchObject<Partial<BodyPerfectionRealmProgress>>({
      realmId: 'mortal',
      discoveredMaterialIds: ['bp_mortal_a'],
      perfected: true,
    })

    // Partial reveal: only the FOUND tc id is listed - the two
    // undiscovered bp_tc_* requirements never leak.
    const tc = rows[1]!
    expect(tc.discoveredMaterialIds).toEqual(['bp_tc_c'])
    expect(tc.perfected).toBe(false)

    const kd = rows[2]!
    expect(kd.discoveredMaterialIds).toEqual(['bp_kd_b'])
  })

  it('emits no rows before any discovery', () => {
    expect(getBodyPerfectionRealmProgress(player())).toEqual([])
  })
})

describe('createDefaultBodyPerfection', () => {
  it('returns an empty, independent slice each call', () => {
    const a = createDefaultBodyPerfection()
    const b = createDefaultBodyPerfection()

    expect(a).toEqual({ discoveredMaterials: [], perfectedRealmIds: [] })
    a.discoveredMaterials.push('x')
    expect(b.discoveredMaterials).toEqual([])
  })
})

describe('validateBodyPerfectionPersistedState', () => {
  const paths = (payload: unknown): string[] => {
    const seen: string[] = []
    validateBodyPerfectionPersistedState(payload, (issue) => seen.push(issue.path))
    return seen
  }

  it('accepts a well-formed slice (empty and populated)', () => {
    expect(paths({ bodyPerfection: { discoveredMaterials: [], perfectedRealmIds: [] } })).toEqual([])
    expect(
      paths({ bodyPerfection: { discoveredMaterials: ['bp_mortal_a'], perfectedRealmIds: ['mortal'] } }),
    ).toEqual([])
  })

  it('emits on absent / non-object / malformed fields', () => {
    expect(paths({})).toEqual(['player.bodyPerfection'])
    expect(paths({ bodyPerfection: 'x' })).toEqual(['player.bodyPerfection'])
    expect(paths({ bodyPerfection: { discoveredMaterials: 'x', perfectedRealmIds: [] } }))
      .toEqual(['player.bodyPerfection.discoveredMaterials'])
    expect(paths({ bodyPerfection: { discoveredMaterials: [], perfectedRealmIds: [1] } }))
      .toEqual(['player.bodyPerfection.perfectedRealmIds'])
  })
})

describe('assertBodyPerfectionIntegrity', () => {
  it('accepts the default empty slice', () => {
    expect(() => assertBodyPerfectionIntegrity(player())).not.toThrow()
  })

  it('accepts a legal discovered+perfected state', () => {
    const p = player((s) => {
      s.realmId = 'qi_refining'
      s.bodyPerfection = {
        discoveredMaterials: ['bp_mortal_a', 'bp_qi_a', 'bp_qi_b'],
        perfectedRealmIds: ['mortal'],
      }
    })

    expect(() => assertBodyPerfectionIntegrity(p)).not.toThrow()
  })

  it('rejects duplicate entries in either set', () => {
    const dupDiscovered = player((s) => {
      s.bodyPerfection = { discoveredMaterials: ['bp_mortal_a', 'bp_mortal_a'], perfectedRealmIds: [] }
    })
    const dupPerfected = player((s) => {
      s.bodyPerfection = {
        discoveredMaterials: ['bp_mortal_a'],
        perfectedRealmIds: ['mortal', 'mortal'],
      }
    })

    expect(() => assertBodyPerfectionIntegrity(dupDiscovered)).toThrowError(/trung lap/)
    expect(() => assertBodyPerfectionIntegrity(dupPerfected)).toThrowError(/trung lap/)
  })

  it('rejects discovered ids outside the authored family', () => {
    const p = player((s) => {
      s.bodyPerfection = { discoveredMaterials: ['spirit_stone'], perfectedRealmIds: [] }
    })

    expect(() => assertBodyPerfectionIntegrity(p)).toThrowError(/khong thuoc nhom/)
  })

  it('rejects a perfected realm with no authored list', () => {
    const p = player((s) => {
      s.realmId = 'mahayana'
      s.bodyPerfection = { discoveredMaterials: [], perfectedRealmIds: ['mahayana'] }
    })

    expect(() => assertBodyPerfectionIntegrity(p)).toThrowError(/khong co material/)
  })

  it('rejects a perfected realm whose authored list is not fully discovered', () => {
    const p = player((s) => {
      s.realmId = 'golden_core'
      s.bodyPerfection = {
        discoveredMaterials: ['bp_kd_a', 'bp_kd_b', 'bp_kd_c'], // bp_kd_d missing
        perfectedRealmIds: ['golden_core'],
      }
    })

    expect(() => assertBodyPerfectionIntegrity(p)).toThrowError(/thieu discovery 'bp_kd_d'/)
  })

  it('rejects a perfected FUTURE realm while allowing future discovery (C2C r60-f2)', () => {
    const futurePerfected = player((s) => {
      s.realmId = 'mortal'
      s.bodyPerfection = {
        discoveredMaterials: ['bp_qi_a', 'bp_qi_b'],
        perfectedRealmIds: ['qi_refining'],
      }
    })
    expect(() => assertBodyPerfectionIntegrity(futurePerfected)).toThrowError(/vuot canh gioi/)

    const futureDiscovery = player((s) => {
      s.realmId = 'mortal'
      s.bodyPerfection = {
        discoveredMaterials: ['bp_qi_a', 'bp_kd_a'],
        perfectedRealmIds: [],
      }
    })
    expect(() => assertBodyPerfectionIntegrity(futureDiscovery)).not.toThrow()
  })
})

// Production seam, no mock surface needed elsewhere: the shipped
// registry is all-empty so these only exercise the fail-closed arm.
describe('shipped-registry fail-closed arm (C2C r65-f1)', () => {
  it('the all-empty production registry can never satisfy canPerfectBodyRealm', async () => {
    vi.resetModules()
    const realData = await vi.importActual<typeof import('../../../data/realm/BodyPerfection')>(
      '../../../data/realm/BodyPerfection',
    )
    expect(Object.values(realData.BODY_PERFECTION_REALM_MATERIALS).every((list) => list.length === 0))
      .toBe(true)
  })
})
