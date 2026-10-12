// Instant ore-to-essence exchange. Legacy worker settings remain only in
// the save shape so existing saves can be read without reviving that system.
import { LUYEN_KHI_TINH_HOA_ID } from '../equipment/TinhHoaMaterial'
import { HERB_AGES } from './ProductionTypes'
import type { HerbAge } from './ProductionTypes'
import {
  PROFESSION_GRADE_ORDER,
  PROFESSION_GRADE_BY_REALM,
  type ProfessionGrade,
} from '../profession/ProfessionGrade'
import type { MaterialBag } from '../material/MaterialBag'
import { materials } from '../../data/materials/materials'
import { isScopeHidden } from '../betaScope'

export interface DecomposeSettings {
  gradeFilter: ProfessionGrade | 'all'
  ageFilter: HerbAge | 'all'
  workers: number
}

/** Retained type for legacy save readers; no cycles create pending output. */
export interface DecomposeOutputEntry {
  materialId: string
  amount: number
}

export interface DecomposeOreStack {
  materialId: string
  amount: number
}

export interface DecomposeSystemOptions {
  onEssenceProduced?: (materialId: string, amount: number) => void
}

export type DecomposeOreResult =
  | { ok: true; materialId: string; consumed: number; produced: number }
  | { ok: false; reason: 'scope_hidden' | 'invalid_amount' | 'invalid_ore' | 'insufficient_ore' | 'insufficient_amount' | 'output_capacity' }

/** Existing save contract is accepted and written as inert defaults. */
export interface DecomposeSaveState {
  settings: DecomposeSettings
  nextCycleAt: number
  started: boolean
}

const ORE_PER_WORKER_PER_CYCLE = 2

export class DecomposeSystem {
  private readonly bag: MaterialBag
  private readonly onEssenceProduced?: DecomposeSystemOptions['onEssenceProduced']

  constructor(bag: MaterialBag, options: DecomposeSystemOptions = {}) {
    this.bag = bag
    this.onEssenceProduced = options.onEssenceProduced
  }

  /** Detached inventory projection for the explicit ore picker. */
  getAvailableOres(): DecomposeOreStack[] {
    if (isScopeHidden('equipmentOreDecompose')) return []
    return this.bag.getAll()
      .filter((stack) => parseOre(stack.material.id) !== null)
      .map((stack) => ({ materialId: stack.material.id, amount: stack.amount }))
  }

  /** Read-only quote using the exact same validation and output math as commit. */
  previewDecomposeOre(materialId: string, amount: number): DecomposeOreResult {
    return this.resolveDecomposeOre(materialId, amount)
  }

  /** Atomically exchange a player-selected ore quantity for refined essence. */
  decomposeOre(materialId: string, amount: number): DecomposeOreResult {
    const quote = this.resolveDecomposeOre(materialId, amount)
    if (!quote.ok) return quote

    const oreMaterial = this.bag.get(materialId)?.material
    const essence = materials.find((material) => material.id === quote.materialId)
    if (!oreMaterial || !essence || !this.bag.remove(materialId, quote.consumed)) {
      return { ok: false, reason: 'insufficient_ore' }
    }

    const overflow = this.bag.add(essence, quote.produced)
    if (overflow > 0) {
      // Synchronous preflight/mutation should make this unreachable. Restore
      // both sides if the bag contract changes and reports an overflow.
      const accepted = quote.produced - overflow
      if (accepted > 0) this.bag.remove(quote.materialId, accepted)
      this.bag.add(oreMaterial, quote.consumed)
      return { ok: false, reason: 'output_capacity' }
    }

    this.onEssenceProduced?.(quote.materialId, quote.produced)
    return quote
  }

  /** Legacy settings/timer are normalized to inert values on every write. */
  getSaveState(): DecomposeSaveState {
    return {
      settings: { gradeFilter: 'all', ageFilter: 'all', workers: 0 },
      nextCycleAt: 0,
      started: false,
    }
  }

  /** Old settings and cycle deadlines are accepted but never resume work. */
  restore(_state: DecomposeSaveState | undefined, _restoreNowMs?: number): void {}

  private resolveDecomposeOre(materialId: string, amount: number): DecomposeOreResult {
    if (isScopeHidden('equipmentOreDecompose')) return { ok: false, reason: 'scope_hidden' }
    if (!Number.isSafeInteger(amount) || amount <= 0) return { ok: false, reason: 'invalid_amount' }

    const parsed = parseOre(materialId)
    if (!parsed) return { ok: false, reason: 'invalid_ore' }
    if (!this.bag.has(materialId, amount)) return { ok: false, reason: 'insufficient_ore' }

    const essence = materials.find((material) => material.id === LUYEN_KHI_TINH_HOA_ID)
    if (!essence) return { ok: false, reason: 'output_capacity' }

    const gradeIndex = PROFESSION_GRADE_ORDER.indexOf(parsed.grade)
    const base = 1 + Math.max(0, gradeIndex) * 0.5
    const ageIndex = HERB_AGES.indexOf(parsed.age)
    const ageFactor = 2 ** Math.max(0, ageIndex)
    const produced = Math.floor((amount * base * ageFactor) / ORE_PER_WORKER_PER_CYCLE)

    if (produced < 1) return { ok: false, reason: 'insufficient_amount' }

    if (
      !Number.isSafeInteger(produced) ||
      produced <= 0 ||
      this.bag.canAcceptAmount(essence, produced) < produced
    ) {
      return { ok: false, reason: 'output_capacity' }
    }

    return { ok: true, materialId: LUYEN_KHI_TINH_HOA_ID, consumed: amount, produced }
  }
}

// Inverse of buildProfessionMaterialId('ore', realm, age).
const ORE_ID_PATTERN = new RegExp(`^(.+)_ore_(${HERB_AGES.join('|')})$`)

/** `<realmId>_ore_<age>` -> grade and age for authored ore material ids. */
export function parseOre(oreId: string): { grade: ProfessionGrade; age: HerbAge } | null {
  const match = ORE_ID_PATTERN.exec(oreId)
  if (!match) return null

  const grade = PROFESSION_GRADE_BY_REALM[match[1]!]
  if (!grade) return null

  return { grade, age: match[2] as HerbAge }
}
