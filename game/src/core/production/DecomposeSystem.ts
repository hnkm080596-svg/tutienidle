// Instant ore-to-essence exchange. Legacy worker settings remain only in
// the save shape so existing saves can be read without reviving that system.
import { BUI_GO_ID, LUYEN_DAN_TINH_HOA_ID, LUYEN_KHI_TINH_HOA_ID } from '../equipment/TinhHoaMaterial'
import { parseProfessionResourceId } from '../profession/ProfessionMaterial'
import type { Material } from '../material/Material'
import type { MaterialStack } from '../material/MaterialStack'
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
  deliverOutput?: (entry: DecomposeOutputEntry) => void
  onEssenceProduced?: (materialId: string, amount: number) => void
}

export type DecomposeOreResult =
  | { ok: true; materialId: string; consumed: number; produced: number }
  | { ok: false; reason: 'scope_hidden' | 'invalid_amount' | 'invalid_ore' | 'insufficient_ore' | 'insufficient_amount' | 'output_capacity' }

/** Existing save contract is accepted and written as inert defaults. */
export interface DecomposeSaveState {
  settings?: {
    workers?: number
    gradeFilter?: string
    ageFilter?: string
  }
  nextCycleAt?: number
  started?: boolean
}

export type DecomposeFamily = 'ore' | 'wood' | 'herb'

export interface DecomposePreviewEntry {
  materialId: string
  minAmount: number
  maxAmount: number
}

export type DecomposeBatchResult =
  | { ok: true }
  | { ok: false; reason: 'scope_hidden' | 'insufficient_amount' | 'output_capacity' | 'inventory_changed' }

export interface DecomposableStack {
  family: DecomposeFamily
  grade: ProfessionGrade
  age: HerbAge
  outputMaterialId: string
}

export const DECOMPOSE_OUTPUT_BY_FAMILY: Readonly<Record<DecomposeFamily, string>> = {
  ore: LUYEN_KHI_TINH_HOA_ID,
  wood: BUI_GO_ID,
  herb: LUYEN_DAN_TINH_HOA_ID,
}

export function classifyDecomposableMaterial(material: Material): DecomposableStack | null {
  const profession = material.profession
  if (profession?.resourceKind === 'herb') {
    const grade = PROFESSION_GRADE_BY_REALM[profession.realmId ?? '']
    const age = profession.age
    if (!grade || !age || !HERB_AGES.includes(age)) return null
    return { family: 'herb', grade, age, outputMaterialId: DECOMPOSE_OUTPUT_BY_FAMILY.herb }
  }
  const ore = parseOre(material.id)
  if (ore) return { family: 'ore', ...ore, outputMaterialId: DECOMPOSE_OUTPUT_BY_FAMILY.ore }
  const wood = parseWood(material.id)
  if (wood) return { family: 'wood', ...wood, outputMaterialId: DECOMPOSE_OUTPUT_BY_FAMILY.wood }
  return null
}

export class DecomposeSystem {
  private readonly bag: MaterialBag
  private readonly deliverOutput?: DecomposeSystemOptions['deliverOutput']
  private readonly onEssenceProduced?: DecomposeSystemOptions['onEssenceProduced']

  constructor(bag: MaterialBag, options: DecomposeSystemOptions = {}) {
    this.bag = bag
    this.deliverOutput = options.deliverOutput
    this.onEssenceProduced = options.onEssenceProduced
  }

  listDecomposableIds(): string[] {
    if (isScopeHidden('equipmentOreDecompose')) return []
    return this.bag.getAll()
      .filter((stack) => {
        const match = classifyDecomposableMaterial(stack.material)
        return match !== null && stackOutputAmount(match.grade, match.age, stack.amount) >= 1
      })
      .map((stack) => stack.material.id)
  }

  previewDecompose(ids: readonly string[]): DecomposePreviewEntry[] {
    if (isScopeHidden('equipmentOreDecompose')) return []
    const totals = new Map<string, number>()
    for (const stack of this.resolveDecomposableStacks(ids)) {
      const match = classifyDecomposableMaterial(stack.material)
      if (!match) continue
      const output = stackOutputAmount(match.grade, match.age, stack.amount)
      if (output > 0) totals.set(match.outputMaterialId, (totals.get(match.outputMaterialId) ?? 0) + output)
    }
    return [...totals.entries()].map(([materialId, amount]) => ({
      materialId,
      minAmount: amount,
      maxAmount: amount,
    }))
  }

  decompose(ids: readonly string[]): boolean {
    return this.decomposeWithResult(ids).ok
  }

  decomposeWithResult(ids: readonly string[]): DecomposeBatchResult {
    if (isScopeHidden('equipmentOreDecompose')) return { ok: false, reason: 'scope_hidden' }
    const stacks = this.resolveDecomposableStacks(ids)
    const outputs: DecomposeOutputEntry[] = []
    for (const stack of stacks) {
      const match = classifyDecomposableMaterial(stack.material)
      if (!match) continue
      const amount = stackOutputAmount(match.grade, match.age, stack.amount)
      if (amount < 1) continue
      mergeOutputRow(outputs, { materialId: match.outputMaterialId, amount })
    }
    if (outputs.length === 0) return { ok: false, reason: 'insufficient_amount' }

    // When no runtime adapter owns delivery, preflight the whole command
    // against the bag so a capacity failure cannot consume any input.
    if (!this.deliverOutput) {
      for (const output of outputs) {
        const material = materials.find((entry) => entry.id === output.materialId)
        if (!material || this.bag.canAcceptAmount(material, output.amount) < output.amount) return { ok: false, reason: 'output_capacity' }
      }
    }

    const removed: Array<{ materialId: string; amount: number }> = []
    for (const stack of stacks) {
      const match = classifyDecomposableMaterial(stack.material)
      if (!match || stackOutputAmount(match.grade, match.age, stack.amount) < 1) continue
      if (!this.bag.remove(stack.material.id, stack.amount)) {
        for (const entry of removed) this.bag.add(stacks.find((candidate) => candidate.material.id === entry.materialId)!.material, entry.amount)
        return { ok: false, reason: 'inventory_changed' }
      }
      removed.push({ materialId: stack.material.id, amount: stack.amount })
    }

    for (const output of outputs) {
      if (!this.deliver(output)) return { ok: false, reason: 'output_capacity' }
      this.onEssenceProduced?.(output.materialId, output.amount)
    }
    return { ok: true }
  }

  private deliver(entry: DecomposeOutputEntry): boolean {
    if (this.deliverOutput) {
      this.deliverOutput(entry)
      return true
    }
    const material = materials.find((candidate) => candidate.id === entry.materialId)
    if (!material || this.bag.add(material, entry.amount) > 0) return false
    return true
  }

  private resolveDecomposableStacks(ids: readonly string[]): Readonly<MaterialStack>[] {
    const seen = new Set<string>()
    const stacks: Readonly<MaterialStack>[] = []
    for (const id of ids) {
      if (seen.has(id)) continue
      seen.add(id)
      const stack = this.bag.get(id)
      if (!stack || stack.amount <= 0 || classifyDecomposableMaterial(stack.material) === null) continue
      stacks.push(stack)
    }
    return stacks
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

    if (!this.deliver({ materialId: quote.materialId, amount: quote.produced })) {
      this.bag.add(oreMaterial, quote.consumed)
      return { ok: false, reason: 'output_capacity' }
    }

    this.onEssenceProduced?.(quote.materialId, quote.produced)
    return quote
  }

  /** Legacy settings/timer are normalized to inert values on every write. */
  getSaveState(): DecomposeSaveState {
    return {}
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
    const produced = Math.floor((amount * base * ageFactor) / 6)

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

/** Only newly authored age-only resource identities are decomposable. */
export function parseOre(id: string): { grade: ProfessionGrade; age: HerbAge } | null {
  const age = parseProfessionResourceId('ore', id)
  return age ? { grade: 'cuu_pham', age } : null
}

export function parseWood(id: string): { grade: ProfessionGrade; age: HerbAge } | null {
  const age = parseProfessionResourceId('wood', id)
  return age ? { grade: 'cuu_pham', age } : null
}

/** base = 1 + gradeIndex x 0.5; ageFactor = 2^ageIndex (spec-khoa, tuning sau playtest). */
function outputFactors(grade: ProfessionGrade, age: HerbAge): { base: number; ageFactor: number } {
  const gradeIndex = PROFESSION_GRADE_ORDER.indexOf(grade)

  const ageIndex = HERB_AGES.indexOf(age)

  return {
    base: 1 + Math.max(0, gradeIndex) * 0.5,
    ageFactor: 2 ** Math.max(0, ageIndex),
  }
}

/**
 * Instant yield for a whole stack: floor(amount x base x ageFactor / 6).
 * Sub-unit yield is not consumed so splitting a stack cannot create extra
 * essence and the quote always describes a deliverable integer amount.
 */
function stackOutputAmount(grade: ProfessionGrade, age: HerbAge, amount: number): number {
  const { base, ageFactor } = outputFactors(grade, age)

  return Math.floor((amount * base * ageFactor) / 6)
}

/** Cong don output vao rows theo materialId - giu thu tu nhanh gap dau tien. */
function mergeOutputRow(rows: DecomposeOutputEntry[], row: DecomposeOutputEntry): void {
  const existing = rows.find((entry) => entry.materialId === row.materialId)

  if (existing) {
    existing.amount += row.amount

    return
  }

  rows.push({ ...row })
}
