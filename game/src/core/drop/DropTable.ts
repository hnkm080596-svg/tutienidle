/**
 * Shared loot tables (spec E1/E2).
 *
 * Two layers compose per kill: the STAGE table decides which items exist at
 * this point of progression, the FAMILY table decides the themed parts. An
 * enemy references both by realm/floor and by family instead of carrying its
 * own hand-copied reward tables.
 *
 * A table has two compartments on purpose. 'guaranteed' keeps the current
 * behaviour of an independent chance per line, which is what a deliberately
 * certain drop needs. 'pool' is weighted and drawn N times, which is the only
 * shape in which "this modifier adds a roll" means anything.
 */
export type DropKind = 'material' | 'equipment' | 'equipment_any' | 'pill' | 'technique'

export interface AmountRange {
  min: number
  max: number
}

export interface DropEntry {
  kind: DropKind

  /** Required for every kind except 'equipment_any', which draws from the registry. */
  itemId?: string

  /** Materials and pills only; equipment always yields exactly one instance. */
  amount?: AmountRange
}

export interface GuaranteedDropEntry extends DropEntry {
  /** 1 = always. */
  chance: number
}

export interface WeightedDropEntry extends DropEntry {
  weight: number
}

export interface DropTable {
  guaranteed: GuaranteedDropEntry[]
  pool: WeightedDropEntry[]
}

export interface StageDropTable extends DropTable {
  realmId: string

  /** Inclusive floor band. One band per realm today; splitting needs no code change. */
  floors: AmountRange

  currency: {
    spiritStone: AmountRange
    techniqueInsight: AmountRange
  }
}

export interface FamilyDropTable extends DropTable {
  familyId: string
}

/**
 * Hand-placed drops that must NOT dissolve into the shared pool (spec E7) -
 * great_dao_seed at 0.01% is the gate onto Foundation Establishment, and a
 * weighted line would either misplace it or lose it. Signature drops take no
 * extra rolls and receive no quality bonus.
 */
export interface SignatureDrop extends DropEntry {
  chance: number

  /** Only rolled when the kill carries this modifier id. */
  requiresModifier?: string
}

export function assertDropEntryIsAddressable(entry: DropEntry): void {
  if (entry.kind !== 'equipment_any' && !entry.itemId) {
    throw new Error(`Drop entry of kind ${entry.kind} is missing itemId`)
  }
}
