// Task 14 (rework P4, 2026-09-01, spec item-grade-quality-model sec5.6) -
// Tab Phan Giai: phan giai nguyen lieu thanh tinh hoa.
//
// DIRECT REWORK (2026-10-11, owner ruling): co che worker-cycle BI GO BO.
// Phan Giai gio la ACTION truc tiep multi-select, mirror Hoa Luyen trang
// bi (EquipmentOpsSystem.previewDissolveRewards + dissolveItems): UI hien
// grid tui nguyen lieu, nguoi choi chon stack (nguyen stack theo
// materialId), modal xac nhan hien previewDecompose(), decompose() dot
// nguyen stack ngay lap tuc - KHONG nhan cong, KHONG chu ky tick, KHONG
// offline settle.
//
// Materials economy rework (2026-10-11, owner-locked spec) - BA nhanh
// phan giai, moi nhanh mot output id duy nhat (khong bien the tuoi/pham):
//   ore  (`<realm>_ore_<age>`)  -> luyen_khi_tinh_hoa
//   wood (`<realm>_wood_<age>`) -> bui_go
//   herb (profession.resourceKind 'herb', realm+age trong metadata)
//                               -> luyen_dan_tinh_hoa
//
// Nguyen tac (giu nguyen):
// - Nguon DUY NHAT cua tinh hoa ngoai Hoa Luyen trang bi.
// - Yield moi stack (balance pass 2026-10-11: /2 -> /6 - xem
//   balance-tuning report; /2 rot ~3.4k tinh hoa/ngay cho beta,
//   gap ~20x nhu cau):
//   yield = ceil(amount/6 x base x ageFactor) voi
//   base = 1 + gradeIndex x 0.5, ageFactor = 2^ageIndex.
// - Output di QUA CUNG duong grant worker cycle dung: GameManager
//   inject deliverOutput -> tickOps.deliverDecomposeOutput (bag.add +
//   overflow toast + collect-quest hook) - khong duplicate quy tac
//   overflow.
//
// Ore/wood id convention (gp123 6E C2): `<realmId>_<kind>_<age>` (age in
// decade..thuong_co - materials.ts generator truc tuoi thong nhat).
// Grade suy tu realmId qua PROFESSION_GRADE_BY_REALM - ke ca herb
// (grotto herbs mang realmId trong profession metadata).
import {
  BUI_GO_ID,
  LUYEN_DAN_TINH_HOA_ID,
  LUYEN_KHI_TINH_HOA_ID,
} from '../equipment/TinhHoaMaterial'
import type { Material } from '../material/Material'
import { HERB_AGES } from './ProductionTypes'
import type { HerbAge } from './ProductionTypes'
import {
  PROFESSION_GRADE_ORDER,
  PROFESSION_GRADE_BY_REALM,
  type ProfessionGrade,
} from '../profession/ProfessionGrade'
import type { MaterialBag } from '../material/MaterialBag'
import type { MaterialStack } from '../material/MaterialStack'
import { isScopeHidden } from '../betaScope'

/** Mot dong output tinh hoa (delivery contract cua deliverDecomposeOutput). */
export interface DecomposeOutputEntry {
  materialId: string
  amount: number
}

/**
 * Mot dong preview reward cho modal xac nhan - mirror
 * `{materialId, minAmount, maxAmount}` cua previewDissolveRewards.
 * Yield deterministic nen minAmount === maxAmount; mot dong moi output
 * family (ore/wood/herb).
 */
export interface DecomposePreviewEntry {
  materialId: string
  minAmount: number
  maxAmount: number
}

/**
 * Materials economy rework (2026-10-11) - nhom nguyen lieu phan giai
 * duoc. Thu tu quy uoc ore -> wood -> herb cho row output on dinh.
 */
export type DecomposeFamily = 'ore' | 'wood' | 'herb'

/** Mot stack trong bag phan giai duoc: grade/age da phan giai + output id. */
export interface DecomposableStack {
  family: DecomposeFamily

  grade: ProfessionGrade

  age: HerbAge

  /** Output material id duy nhat cua nhanh (khong bien the tuoi/pham). */
  outputMaterialId: string
}

/** Output id duy nhat theo nhanh - nguon su that cua mapping ore/wood/herb. */
export const DECOMPOSE_OUTPUT_BY_FAMILY: Readonly<Record<DecomposeFamily, string>> = {
  ore: LUYEN_KHI_TINH_HOA_ID,
  wood: BUI_GO_ID,
  herb: LUYEN_DAN_TINH_HOA_ID,
}

/**
 * Phan loai mot material thanh stack phan giai duoc (neu co).
 * - ore/wood: grammar id `<realm>_<kind>_<age>` (nguoc
 *   buildProfessionMaterialId), grade tu realm.
 * - herb: profession.resourceKind 'herb', realm+age doc tu metadata
 *   (spec: herb khong parse duoc realm thi lay grade tu realmId giong
 *   wood); thieu realm hop le hoac age -> khong phan giai duoc.
 */
export function classifyDecomposableMaterial(material: Material): DecomposableStack | null {
  const profession = material.profession

  if (profession?.resourceKind === 'herb') {
    const grade = PROFESSION_GRADE_BY_REALM[profession.realmId]
    const age = profession.age

    if (!grade || !age || !HERB_AGES.includes(age)) {
      return null
    }

    return { family: 'herb', grade, age, outputMaterialId: DECOMPOSE_OUTPUT_BY_FAMILY.herb }
  }

  const ore = parseOre(material.id)

  if (ore) {
    return { family: 'ore', ...ore, outputMaterialId: DECOMPOSE_OUTPUT_BY_FAMILY.ore }
  }

  const wood = parseWood(material.id)

  if (wood) {
    return { family: 'wood', ...wood, outputMaterialId: DECOMPOSE_OUTPUT_BY_FAMILY.wood }
  }

  return null
}

export interface DecomposeSystemOptions {
  /**
   * Duong grant tinh hoa - GameManager inject
   * `tickOps.deliverDecomposeOutput` (deferred closure vi tickOps duoc
   * gan sau trong constructor). Optional: standalone construction
   * (unit test) van remove duoc stack, output chi bi bo qua.
   */
  deliverOutput?: (entry: DecomposeOutputEntry) => void
}

/**
 * R7 (AR-08) - detached persistence slice for GameSave.
 *
 * DIRECT REWORK: khong con gi can persist (khong settings, khong cycle
 * timer). Cac field legacy giu dang OPTIONAL de payload cu
 * ({settings:{workers,gradeFilter,ageFilter}, nextCycleAt, started})
 * van type-check qua save boundary - restore() accept-and-ignore,
 * worker state KHONG BAO GIO hoi sinh.
 */
export interface DecomposeSaveState {
  settings?: {
    workers?: number
    gradeFilter?: string
    ageFilter?: string
  }
  nextCycleAt?: number
  started?: boolean
}

export class DecomposeSystem {
  private readonly bag: MaterialBag

  private readonly deliverOutput?: (entry: DecomposeOutputEntry) => void

  constructor(bag: MaterialBag, options: DecomposeSystemOptions = {}) {
    this.bag = bag
    this.deliverOutput = options.deliverOutput
  }

  /**
   * Danh sach materialId cua moi stack CON STOCK phan giai duoc trong
   * tui nguyen lieu (ca 3 nhanh ore/wood/herb). UI render grid tui
   * nguyen lieu va filter bang dropdown cua chinh bag - domain khong
   * con gradeFilter/ageFilter (cung ruling DissolveTab: filter song o
   * UI).
   */
  listDecomposableIds(): string[] {
    // BETA SCOPE LOCK v2 - hidden tab's query fails closed as well.
    if (isScopeHidden('equipmentOreDecompose')) {
      return []
    }

    return this.bag
      .getAll()
      .filter((stack) => stack.amount > 0 && classifyDecomposableMaterial(stack.material) !== null)
      .map((stack) => stack.material.id)
  }

  /**
   * Quote reward cho danh sach materialId da chon (nguyen stack moi
   * materialId) - mirror previewDissolveRewards: tra TONG theo output
   * materialId (mot dong moi family), khong mutate gi ca. Id khong
   * phan giai duoc hoac het hang bi bo qua; tong = 0 -> [].
   */
  previewDecompose(ids: readonly string[]): DecomposePreviewEntry[] {
    // BETA SCOPE LOCK v2 - hidden tab's quote fails closed.
    if (isScopeHidden('equipmentOreDecompose')) {
      return []
    }

    const totals = new Map<string, number>()

    for (const stack of this.resolveDecomposableStacks(ids)) {
      const match = classifyDecomposableMaterial(stack.material)

      if (!match) {
        continue
      }

      const output = stackOutputAmount(match.grade, match.age, stack.amount)

      totals.set(match.outputMaterialId, (totals.get(match.outputMaterialId) ?? 0) + output)
    }

    return [...totals.entries()]
      .filter(([, total]) => total > 0)
      .map(([materialId, total]) => ({ materialId, minAmount: total, maxAmount: total }))
  }

  /**
   * Dot NGUYEN STACK cua moi materialId duoc chon va credit output
   * qua duong grant chung (deliverOutput, mot entry moi family). Tra
   * false khi khong co gi duoc phan giai (ids rong / toan id ngoai
   * hoac het hang). Partial failure: stack nao remove duoc thi tinh -
   * bag.remove tu chan du lieu xau nen khong the tra nua stack.
   */
  decompose(ids: readonly string[]): boolean {
    // BETA SCOPE LOCK v2 - the hidden action fails closed (direct API
    // too, same precedent as the retired setSetting).
    if (isScopeHidden('equipmentOreDecompose')) {
      return false
    }

    const stacks = this.resolveDecomposableStacks(ids)

    if (stacks.length === 0) {
      return false
    }

    let removedAny = false
    const outputs: DecomposeOutputEntry[] = []

    for (const stack of stacks) {
      const match = classifyDecomposableMaterial(stack.material)

      if (!match) {
        continue
      }

      const output = stackOutputAmount(match.grade, match.age, stack.amount)

      if (!this.bag.remove(stack.material.id, stack.amount)) {
        continue
      }

      removedAny = true

      if (output > 0) {
        mergeOutputRow(outputs, { materialId: match.outputMaterialId, amount: output })
      }
    }

    for (const row of outputs) {
      this.deliverOutput?.(row)
    }

    return removedAny
  }

  /**
   * R7 (AR-08) - detached snapshot for GameSave. DIRECT REWORK: khong
   * con state persist - tra {} moi save (slice giu lai de payload cu
   * van qua boundary, xem DecomposeSaveState).
   */
  getSaveState(): DecomposeSaveState {
    return {}
  }

  /**
   * Restore mot snapshot cu. DIRECT REWORK: accept-and-ignore - payload
   * legacy ({settings,nextCycleAt,started}) doc het nhung KHONG revive
   * gi (worker state chet vinh vien); slice vang (undefined) cung vay.
   * Khong bao gio throw tren payload xau - validator da chan boundary.
   */
  restore(_state: DecomposeSaveState | undefined): void {
    // Intentionally empty - see DecomposeSaveState.
  }

  /**
   * Resolve danh sach materialId -> stack song trong bag. Dedupe theo
   * materialId (UI co the gui trung), bo qua id khong phan giai duoc
   * (foreign stack: linh thach, tinh hoa, do dac biet) va stack het
   * hang.
   */
  private resolveDecomposableStacks(ids: readonly string[]): Readonly<MaterialStack>[] {
    const seen = new Set<string>()
    const stacks: Readonly<MaterialStack>[] = []

    for (const materialId of ids) {
      if (seen.has(materialId)) {
        continue
      }

      seen.add(materialId)

      const stack = this.bag.get(materialId)

      if (stack === undefined || stack.amount <= 0) {
        continue
      }

      if (classifyDecomposableMaterial(stack.material) === null) {
        continue
      }

      stacks.push(stack)
    }

    return stacks
  }
}

// Regex bien dich MOT LAN - parse chay moi stack khi list/quote/dot.
// Inverse of buildProfessionMaterialId(kind, realm, age) - the
// constructor in ProfessionMaterial.ts owns this grammar.
const ORE_ID_PATTERN = new RegExp(`^(.+)_ore_(${HERB_AGES.join('|')})$`)
const WOOD_ID_PATTERN = new RegExp(`^(.+)_wood_(${HERB_AGES.join('|')})$`)

/** Shared `<realm>_<kind>_<age>` parser - grade lookup lam fail-closed. */
function parseAgedResourceId(
  pattern: RegExp,
  materialId: string,
): { grade: ProfessionGrade; age: HerbAge } | null {
  const match = pattern.exec(materialId)

  if (!match) {
    return null
  }

  const grade = PROFESSION_GRADE_BY_REALM[match[1]!]

  if (!grade) {
    return null
  }

  return { grade, age: match[2] as HerbAge }
}

/** `<realmId>_ore_<age>` -> { grade, age } | null (gp123 6E C2: truc tuoi). */
export function parseOre(oreId: string): { grade: ProfessionGrade; age: HerbAge } | null {
  return parseAgedResourceId(ORE_ID_PATTERN, oreId)
}

/** `<realmId>_wood_<age>` -> { grade, age } | null - sibling grammar cua parseOre. */
export function parseWood(woodId: string): { grade: ProfessionGrade; age: HerbAge } | null {
  return parseAgedResourceId(WOOD_ID_PATTERN, woodId)
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
 * Instant yield for a whole stack: ceil(amount/6 x base x ageFactor) -
 * same math shape as the retired per-worker cycle output, divisor
 * retuned /2 -> /6 in the 2026-10-11 balance pass (fairness ceil
 * keeps partial stacks from rounding to 0).
 */
function stackOutputAmount(grade: ProfessionGrade, age: HerbAge, amount: number): number {
  const { base, ageFactor } = outputFactors(grade, age)

  return Math.ceil((amount / 6) * base * ageFactor)
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
