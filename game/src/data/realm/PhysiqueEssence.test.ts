import { describe, expect, it } from 'vitest'
import {
  PHYSIQUE_ESSENCE_BAND,
  PHYSIQUE_ESSENCE_BAND_DROPS,
  PHYSIQUE_ESSENCES,
  physiqueEssenceBand,
  physiqueEssenceBandDrop,
  physiqueEssenceGradeOf,
  physiqueEssenceMaterialId,
  type PhysiqueEssenceBandRealm,
} from './PhysiqueEssence'
import { PHYSIQUE_GRADES } from './PhysiqueLadder'
import {
  BODY_CHAPTERS,
  bodyChapterEssenceGrade,
  type BodyChapterCurrency,
} from '../../core/realm/body/BodyChapter'
import { materials } from '../materials/materials'
import { STAGE_DROP_TABLES } from '../drop/StageDropTables'

// M-QI-08 (QI-D4b/D4c) - the Tinh Hoa <Grade> family registry: exactly
// the three authored rungs (Pham/Bao/Phap), the pinned realm->grade
// band map, sparse lookups, and the authored-but-unwired band drop
// entries. No live table, cost value, or persisted shape changes.
describe('PhysiqueEssence registry (M-QI-08)', () => {
  it('authors exactly pham/bao/phap in ladder order', () => {
    expect(PHYSIQUE_ESSENCES.map(def => def.grade)).toEqual(['pham', 'bao', 'phap'])
    expect(new Set(PHYSIQUE_ESSENCES.map(def => def.grade)).size).toBe(PHYSIQUE_ESSENCES.length)
    expect(new Set(PHYSIQUE_ESSENCES.map(def => def.materialId)).size).toBe(PHYSIQUE_ESSENCES.length)
  })

  it('keeps the legacy tinh_hoa_pham_the id as the pham member (no rename, no migration)', () => {
    expect(physiqueEssenceMaterialId('pham')).toBe('tinh_hoa_pham_the')
    expect(physiqueEssenceGradeOf('tinh_hoa_pham_the')).toBe('pham')
  })

  it('round-trips the authored grades and returns undefined elsewhere', () => {
    expect(physiqueEssenceMaterialId('bao')).toBe('tinh_hoa_bao_the')
    expect(physiqueEssenceMaterialId('phap')).toBe('tinh_hoa_phap_the')
    expect(physiqueEssenceGradeOf('tinh_hoa_bao_the')).toBe('bao')
    expect(physiqueEssenceGradeOf('tinh_hoa_phap_the')).toBe('phap')

    // QI-D4b: the remaining seven rungs are deliberately unauthored.
    expect(physiqueEssenceMaterialId('linh')).toBeUndefined()
    expect(physiqueEssenceMaterialId('tien')).toBeUndefined()
    expect(physiqueEssenceGradeOf('tinh_hoa_linh_the')).toBeUndefined()
    expect(physiqueEssenceGradeOf('qi_refining_ore_decade')).toBeUndefined()
    expect(physiqueEssenceGradeOf('luyen_khi_tinh_hoa')).toBeUndefined()
  })

  it('every authored essence id is a real essence/monster Material with the Pham-entry shape', () => {
    for (const def of PHYSIQUE_ESSENCES) {
      const material = materials.find(entry => entry.id === def.materialId)
      expect(material, `missing Material for ${def.materialId}`).toBeDefined()
      expect(material?.category).toBe('essence')
      expect(material?.sourceType).toBe('monster')
      expect(material?.stackLimit).toBeUndefined()
      expect(material?.years).toBeUndefined()
      expect(material?.element).toBeUndefined()
      expect(material?.profession).toBeUndefined()
    }
  })

  it('pins the QI-D4b band map: mortal->pham, qi_refining->bao, foundation_establishment->phap', () => {
    expect(PHYSIQUE_ESSENCE_BAND).toEqual({
      mortal: 'pham',
      qi_refining: 'bao',
      foundation_establishment: 'phap',
    })

    const authoredGrades = new Set<string>(PHYSIQUE_ESSENCES.map(def => def.grade))
    for (const grade of Object.values(PHYSIQUE_ESSENCE_BAND)) {
      expect(authoredGrades.has(grade)).toBe(true)
    }
  })

  it('sparse band lookups return undefined for non-banded realms', () => {
    expect(physiqueEssenceBand('mortal')).toBe('pham')
    expect(physiqueEssenceBand('qi_refining')).toBe('bao')
    expect(physiqueEssenceBand('foundation_establishment')).toBe('phap')
    expect(physiqueEssenceBand('golden_core')).toBeUndefined()
    expect(physiqueEssenceBand('unknown_realm')).toBeUndefined()
    expect(physiqueEssenceBand('')).toBeUndefined()
  })

  it('authors a guaranteed-drop entry per band naming that band\'s grade material', () => {
    for (const realm of Object.keys(PHYSIQUE_ESSENCE_BAND) as PhysiqueEssenceBandRealm[]) {
      const drop = PHYSIQUE_ESSENCE_BAND_DROPS[realm]
      expect(drop.kind).toBe('material')
      // Non-vacuous: an unauthored band grade would emit itemId:
      // undefined and still satisfy a bare toBe(undefined).
      expect(drop.itemId).toBeDefined()
      expect(drop.itemId).toBe(physiqueEssenceMaterialId(PHYSIQUE_ESSENCE_BAND[realm]))
      // Exact pin: chance 0.7 / amount 1-3 are the FIXED M-QI-09
      // simulation inputs (spec sec.3.5) - drift must fail loudly.
      expect(drop.chance).toBe(0.7)
      expect(drop.amount).toEqual({ min: 1, max: 3 })
    }

    // Sparse contract mirrors the band map.
    expect(physiqueEssenceBandDrop('golden_core')).toBeUndefined()
    expect(physiqueEssenceBandDrop('unknown_realm')).toBeUndefined()
  })

  it('keeps the authored mortal band entry equal to the live mortal stage line (drift sentinel until M-QI-10)', () => {
    const mortalTable = STAGE_DROP_TABLES.find(table => table.realmId === 'mortal')
    const liveEssenceLine = mortalTable?.guaranteed.find(
      entry => entry.kind === 'material' && entry.itemId === 'tinh_hoa_pham_the',
    )
    expect(liveEssenceLine).toBeDefined()
    expect(PHYSIQUE_ESSENCE_BAND_DROPS.mortal).toEqual(liveEssenceLine)
  })

  it('leaves the live LQ and TC bands emitting no physique essence (premature wiring fails loudly)', () => {
    const familyIds = new Set<string>(PHYSIQUE_ESSENCES.map(def => def.materialId))
    for (const realm of ['qi_refining', 'foundation_establishment'] as const) {
      const table = STAGE_DROP_TABLES.find(entry => entry.realmId === realm)
      const lines = [...(table?.guaranteed ?? []), ...(table?.pool ?? [])]
      expect(
        lines.filter(entry => entry.itemId !== undefined && familyIds.has(entry.itemId)),
        `${realm} band must not emit physique essence before M-QI-10`,
      ).toEqual([])
    }
  })
})

// Spec sec.4.5 - chapter-cost coherence is structural and
// namespace-gated: the composed predicate reads currency.bag first so
// a pill currency can never classify as physique essence on a
// string-id coincidence.
describe('bodyChapterEssenceGrade (M-QI-08 namespace rule)', () => {
  it('resolves the body_refinement material currency to pham', () => {
    const refinement = BODY_CHAPTERS.find(chapter => chapter.id === 'body_refinement')
    expect(refinement).toBeDefined()
    expect(bodyChapterEssenceGrade(refinement!.currency)).toBe('pham')
  })

  it('resolves the meridian pill currency to undefined', () => {
    const meridian = BODY_CHAPTERS.find(chapter => chapter.id === 'meridian')
    expect(meridian).toBeDefined()
    expect(bodyChapterEssenceGrade(meridian!.currency)).toBeUndefined()
  })

  it('a synthetic pill currency carrying a family-member id is NOT physique essence', () => {
    const collidingPill: BodyChapterCurrency = { bag: 'pill', id: 'tinh_hoa_bao_the' }
    expect(bodyChapterEssenceGrade(collidingPill)).toBeUndefined()
  })

  it('every authored chapter currency stays self-consistent with the registry', () => {
    for (const chapter of BODY_CHAPTERS) {
      for (const currency of [chapter.currency, chapter.auxCurrency]) {
        if (currency === undefined) continue
        const grade = bodyChapterEssenceGrade(currency)
        if (grade === undefined) continue
        expect(currency.bag).toBe('material')
        expect(physiqueEssenceMaterialId(grade)).toBe(currency.id)
      }
    }
    // The authored set proves at least one chapter exercises the seam.
    expect(BODY_CHAPTERS.some(chapter => bodyChapterEssenceGrade(chapter.currency) !== undefined)).toBe(true)
  })
})
