import { describe, expect, it } from 'vitest'
import {
  PHYSIQUE_ESSENCE_BAND,
  PHYSIQUE_ESSENCE_BAND_DROPS,
  PHYSIQUE_ESSENCES,
  physiqueEssenceBand,
  PHYSIQUE_ESSENCE_CONVERSION_RATIO,
  physiqueEssenceBandDrop,
  physiqueEssenceGradeOf,
  physiqueEssenceMaterialId,
  type PhysiqueEssenceBandRealm,
} from './PhysiqueEssence'
import { PHYSIQUE_GRADES, type PhysiqueGradeId } from './PhysiqueLadder'
import { essenceSubstitutionYield } from '../../core/realm/body/BodyChapterEssenceSubstitution'
import {
  BODY_CHAPTERS,
  bodyChapterEssenceGrade,
  type BodyChapterCurrency,
} from '../../core/realm/body/BodyChapter'
import { materials } from '../materials/materials'
import { FAMILY_DROP_TABLES } from '../drop/FamilyDropTables'
import { STAGE_DROP_TABLES } from '../drop/StageDropTables'

// M-QI-08 (QI-D4b/D4c) - the Tinh Hoa <Grade> family registry: exactly
// the three authored rungs (Pham/Bao/Phap), the pinned realm->grade
// band map, sparse lookups, and the per-band drop entries that M-QI-10
// wires live into STAGE_DROP_TABLES. No cost value or persisted shape
// changes in either mission.
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

  it('wires every banded realm\'s live stage guaranteed line to the authored band entry (M-QI-10)', () => {
    for (const realm of Object.keys(PHYSIQUE_ESSENCE_BAND) as PhysiqueEssenceBandRealm[]) {
      const table = STAGE_DROP_TABLES.find(entry => entry.realmId === realm)
      expect(table, `no stage table for banded realm ${realm}`).toBeDefined()
      // Identity, not equality: the live line IS the authored map
      // entry - consumed by reference, never a re-authored literal
      // (M-QI-10 spec sec.2). The mortal line flows through the same
      // authority, which subsumes the old production-vs-authored
      // drift sentinel (values are still pinned above at line ~96).
      expect(
        table!.guaranteed.includes(physiqueEssenceBandDrop(realm)!),
        `${realm} guaranteed must carry PHYSIQUE_ESSENCE_BAND_DROPS.${realm} itself`,
      ).toBe(true)
    }
  })

  it('keeps the band authority the only stage/family essence lane (M-QI-10)', () => {
    const familyIds = new Set<string>(PHYSIQUE_ESSENCES.map(def => def.materialId))
    for (const table of STAGE_DROP_TABLES) {
      const bandDrop = physiqueEssenceBandDrop(table.realmId)
      for (const entry of [...table.guaranteed, ...table.pool]) {
        if (entry.itemId === undefined || !familyIds.has(entry.itemId)) continue
        // Any essence-family line in a stage table must be exactly the
        // authored band entry object; non-banded realms emit none.
        expect(
          bandDrop !== undefined && entry === bandDrop,
          `stray essence line in ${table.realmId} stage table - must be the authored band entry`,
        ).toBe(true)
      }
    }
    for (const table of FAMILY_DROP_TABLES) {
      for (const entry of [...table.guaranteed, ...table.pool]) {
        expect(
          entry.itemId === undefined || !familyIds.has(entry.itemId),
          `family table ${table.familyId} emits physique essence outside the band authority`,
        ).toBe(true)
      }
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

  // M-F-ESSENCE (F9 residual) - the cost shapes the TC-side chapters
  // will declare: bao/phap material descriptors classify at the typed
  // boundary with no chapter knowledge.
  it('resolves the bao/phap material descriptors a TC chapter will declare', () => {
    const phapCost: BodyChapterCurrency = { bag: 'material', id: 'tinh_hoa_phap_the' }
    const baoCost: BodyChapterCurrency = { bag: 'material', id: 'tinh_hoa_bao_the' }
    expect(bodyChapterEssenceGrade(phapCost)).toBe('phap')
    expect(bodyChapterEssenceGrade(baoCost)).toBe('bao')
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

// M-QI-09 (QI-D4c + C2C ruling 5) - the sim-locked adjacent ratio
// data contract: every ratio is an integer >= 2 (monotonic - a higher
// grade is strictly more valuable), only adjacent hops are authored,
// and a multi-hop conversion equals the product of its hops so no
// path can beat the chain (no-arbitrage by construction; a future
// direct-skip edge must not beat the compound it replaces).
describe('PHYSIQUE_ESSENCE_CONVERSION_RATIO (M-QI-09)', () => {
  it('authors only grades that have an essence material AND an adjacent lower grade', () => {
    for (const grade of Object.keys(PHYSIQUE_ESSENCE_CONVERSION_RATIO) as PhysiqueGradeId[]) {
      // A ratio on a grade with no essence material is dead data.
      expect(physiqueEssenceMaterialId(grade), `ratio authored for ${grade} with no essence material`).toBeDefined()
      // The hop must be adjacent: the immediately lower rung exists.
      const index = PHYSIQUE_GRADES.findIndex(def => def.id === grade)
      expect(index, `${grade} must have a lower adjacent rung`).toBeGreaterThan(0)
    }
  })

  it('every ratio is an integer >= 2 - strictly more valuable per unit (monotonic)', () => {
    for (const [grade, ratio] of Object.entries(PHYSIQUE_ESSENCE_CONVERSION_RATIO)) {
      expect(Number.isInteger(ratio), `ratio[${grade}] must be an integer`).toBe(true)
      expect(ratio, `ratio[${grade}] must be >= 2`).toBeGreaterThanOrEqual(2)
    }
  })

  it('multi-hop yield equals the product of adjacent hops - no-arbitrage chain', () => {
    // phap -> pham through the bao hop must equal ratio[phap] *
    // ratio[bao]: any authored "skip" that beat the compound would be
    // an arbitrage path (C2C 5).
    const bao = PHYSIQUE_ESSENCE_CONVERSION_RATIO.bao
    const phap = PHYSIQUE_ESSENCE_CONVERSION_RATIO.phap
    expect(bao).toBeDefined()
    expect(phap).toBeDefined()
    expect(essenceSubstitutionYield('pham', 'phap')).toBe(bao! * phap!)
    expect(essenceSubstitutionYield('pham', 'bao')).toBe(bao)
    expect(essenceSubstitutionYield('bao', 'phap')).toBe(phap)
  })
})
