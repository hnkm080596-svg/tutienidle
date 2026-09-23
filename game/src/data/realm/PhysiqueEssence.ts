import type { GuaranteedDropEntry } from '../../core/drop/DropTable'
import { TINH_HOA_PHAM_THE_MATERIAL_ID } from './BodyRefinement'
import type { PhysiqueGradeId } from './PhysiqueLadder'

// M-QI-08 (QI-D4b) - the Tinh Hoa <Grade> physique-essence family:
// material-id <-> grade identity, the pinned realm->grade band map,
// and the authored (unwired until M-QI-10) per-band drop entries.
//
// This module is a PURE material-id registry: it knows nothing about
// BodyChapterCurrency namespaces (the bag gate lives in
// core/realm/body/BodyChapter.ts's bodyChapterEssenceGrade).
//
// QI-D4b authors only Pham/Bao/Phap - the remaining seven rungs are
// deliberately absent (no extrapolation). The legacy id
// 'tinh_hoa_pham_the' IS the pham member - no rename, no migration.
export interface PhysiqueEssenceDefinition {
  grade: PhysiqueGradeId
  materialId: string
}

export const PHYSIQUE_ESSENCES = [
  { grade: 'pham', materialId: TINH_HOA_PHAM_THE_MATERIAL_ID },
  { grade: 'bao', materialId: 'tinh_hoa_bao_the' },
  { grade: 'phap', materialId: 'tinh_hoa_phap_the' },
] as const satisfies readonly PhysiqueEssenceDefinition[]

const GRADE_TO_MATERIAL: ReadonlyMap<PhysiqueGradeId, string> = new Map(
  PHYSIQUE_ESSENCES.map(def => [def.grade, def.materialId]),
)
const MATERIAL_TO_GRADE: ReadonlyMap<string, PhysiqueGradeId> = new Map(
  PHYSIQUE_ESSENCES.map(def => [def.materialId, def.grade]),
)

// Forward lookup - undefined for rungs with no authored essence.
export function physiqueEssenceMaterialId(grade: PhysiqueGradeId): string | undefined {
  return GRADE_TO_MATERIAL.get(grade)
}

// Reverse lookup - the canonical "is this material id physique essence,
// and which grade" read. Undefined for non-family ids.
export function physiqueEssenceGradeOf(materialId: string): PhysiqueGradeId | undefined {
  return MATERIAL_TO_GRADE.get(materialId)
}

// QI-D4b pinned realm -> grade map. The exact key union makes sparsity
// type-honest: realms absent from the union have no authored physique
// essence drop identity.
export type PhysiqueEssenceBandRealm =
  | 'mortal'
  | 'qi_refining'
  | 'foundation_establishment'

export const PHYSIQUE_ESSENCE_BAND: Readonly<
  Record<PhysiqueEssenceBandRealm, PhysiqueGradeId>
> = {
  mortal: 'pham',
  qi_refining: 'bao',
  foundation_establishment: 'phap',
}

// Sparse lookups accepting ANY realm id - absent realms return
// undefined; M-QI-10 consumers must treat undefined as "no band".
const REALM_TO_GRADE: ReadonlyMap<string, PhysiqueGradeId> = new Map(
  Object.entries(PHYSIQUE_ESSENCE_BAND),
)

export function physiqueEssenceBand(realmId: string): PhysiqueGradeId | undefined {
  return REALM_TO_GRADE.get(realmId)
}

// QI-D4c adjacent conversion ratios - sim-locked by M-QI-09 (spec
// docs/p7/missions/mqi-09-essence-substitution.spec.md sec.3.4):
// `ratio[g]` is the number of grade-(g-1) units one unit of grade g
// substitutes for at a Body chapter cost check. Integer >= 2 (each
// higher unit strictly more valuable, monotonic). Only adjacent hops
// are authored; multi-hop yield is their product, so no conversion
// path can beat the chain (no-arbitrage by construction - a future
// skip edge would have to exceed the compound it replaces). Rungs
// without an authored essence material are absent - absence is the
// contract, not an error. The values are the sim lock, NOT a balance
// guess: any retune of drops, tier caps, or arc length re-runs the sim
// and re-locks them in the same change (spec sec.3.5).
export const PHYSIQUE_ESSENCE_CONVERSION_RATIO: Readonly<
  Partial<Record<PhysiqueGradeId, number>>
> = {
  bao: 2,
  phap: 2,
}

export function physiqueEssenceConversionRatio(
  grade: PhysiqueGradeId,
): number | undefined {
  return PHYSIQUE_ESSENCE_CONVERSION_RATIO[grade]
}

// Authored per-band guaranteed-drop entries, DERIVED band -> grade ->
// materialId so an entry can never name a material of the wrong grade.
// Numbers mirror the live mortal line (chance 0.7, amount 1-3) and are
// the FIXED simulation inputs for M-QI-09's ratio lock - any later
// retune must re-run the sim and re-lock ratios in the same change
// (spec sec.3.5). M-QI-10 wires these into STAGE_DROP_TABLES live.
export const PHYSIQUE_ESSENCE_BAND_DROPS: Readonly<
  Record<PhysiqueEssenceBandRealm, GuaranteedDropEntry>
> = Object.fromEntries(
  (Object.keys(PHYSIQUE_ESSENCE_BAND) as PhysiqueEssenceBandRealm[]).map(realm => [
    realm,
    {
      kind: 'material',
      itemId: physiqueEssenceMaterialId(PHYSIQUE_ESSENCE_BAND[realm]),
      amount: { min: 1, max: 3 },
      chance: 0.7,
    } satisfies GuaranteedDropEntry,
  ]),
) as Record<PhysiqueEssenceBandRealm, GuaranteedDropEntry>

const REALM_TO_BAND_DROP: ReadonlyMap<string, GuaranteedDropEntry> = new Map(
  Object.entries(PHYSIQUE_ESSENCE_BAND_DROPS),
)

export function physiqueEssenceBandDrop(realmId: string): GuaranteedDropEntry | undefined {
  return REALM_TO_BAND_DROP.get(realmId)
}
