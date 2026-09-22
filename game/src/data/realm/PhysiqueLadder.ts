// M-QI-07 (QI-D4) - the physique (The Phach) ladder: the canonical
// ordered identity data for player.physiqueGrade. Pure data - every
// rung is an id only; no stat bonuses ride the ladder (per-grade stats
// are deferred to the balance phase, QI-D4d).
//
// Order IS the ladder: index 0 is the mortal baseline 'pham', each
// step forward is exactly one authored BodyChapter.physiqueAdvancement
// transition away (BodyProgressionSystem.derivePhysiqueGrade walks the
// contiguous authored prefix from 'pham').
export type PhysiqueGradeId =
  | 'pham'
  | 'bao'
  | 'phap'
  | 'linh'
  | 'huyen'
  | 'chan'
  | 'dao'
  | 'than'
  | 'thanh'
  | 'tien'

// Extensible rung definition (spec v4: a typed { id } shape, never bare
// strings) - future rung data (labels, bonuses) extends this interface
// instead of re-shaping the persisted id. The satisfies check means any
// required field added here must exist on every catalog entry.
export interface PhysiqueGradeDefinition {
  id: PhysiqueGradeId
}

export const PHYSIQUE_GRADES = [
  { id: 'pham' },
  { id: 'bao' },
  { id: 'phap' },
  { id: 'linh' },
  { id: 'huyen' },
  { id: 'chan' },
  { id: 'dao' },
  { id: 'than' },
  { id: 'thanh' },
  { id: 'tien' },
] as const satisfies readonly PhysiqueGradeDefinition[]

const GRADE_INDEX: ReadonlyMap<PhysiqueGradeId, number> = new Map(
  PHYSIQUE_GRADES.map((def, index) => [def.id, index]),
)

export function isPhysiqueGradeId(value: unknown): value is PhysiqueGradeId {
  return typeof value === 'string' && GRADE_INDEX.has(value as PhysiqueGradeId)
}

export function getPhysiqueGradeIndex(id: PhysiqueGradeId): number {
  return GRADE_INDEX.get(id) ?? -1
}
