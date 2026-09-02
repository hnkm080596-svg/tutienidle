// Task 14 (rework P4, 2026-09-01, spec item-grade-quality-model §5.6) —
// Tab Phân Giải engine: phân giải Linh Khoáng thành Luyện Khí Tinh Hoa.
//
// Nguyên tắc (user-approved):
// - Nguồn DUY NHẤT của tinh hoa ngoài Hóa Luyện trang bị.
// - Settings người chơi: lọc phẩm, lọc chất, số nhân công (pool chung,
//   capacity do GameManager cấp — pattern autoWorkerCapacity).
// - Chạy như production cycle (tick theo nowMs, không instant) — khớp
//   kiến trúc ProductionSystem và quy tắc cân bằng 6F per-worker.
// - Output tuyến tính: base(grade) × hệ_số(quality) × workers.
//   base = 1 + gradeIndex × 0.5; hệ số chất = 2^qualityIndex.
//   (Khởi điểm — tuning sau playtest theo 6F "sản xuất ≤ tiêu thụ
//   trên mỗi nhân công, cùng phẩm cùng chất".)
//
// Ore id convention: `<realmId>_ore_<quality>` (materials.ts L212).
// Grade của ore suy từ realmId qua PROFESSION_GRADE_BY_REALM.
import { LUYEN_KHI_TINH_HOA_ID } from '../equipment/TinhHoaMaterial'
import { ITEM_QUALITY_ORDER, type ItemQuality } from '../item/ItemQuality'
import {
  PROFESSION_GRADE_ORDER,
  PROFESSION_GRADE_BY_REALM,
  type ProfessionGrade,
} from '../profession/ProfessionGrade'
import type { MaterialBag } from '../material/MaterialBag'

export interface DecomposeSettings {
  gradeFilter: ProfessionGrade | 'all'
  qualityFilter: ItemQuality | 'all'
  workers: number
}

export interface DecomposeOutputEntry {
  materialId: string
  amount: number
}

export interface DecomposeSystemOptions {
  autoWorkerCapacity: number
  cycleSeconds?: number
}

const DEFAULT_CYCLE_SECONDS = 30

/** Khoáng tiêu thụ mỗi worker mỗi lượt. */
const ORE_PER_WORKER_PER_CYCLE = 2

export class DecomposeSystem {
  private readonly bag: MaterialBag

  private readonly autoWorkerCapacity: number

  private readonly cycleMs: number

  private settings: DecomposeSettings

  private nextCycleAt = 0

  private started = false

  private pendingOutput: DecomposeOutputEntry[] = []

  constructor(bag: MaterialBag, options: DecomposeSystemOptions) {
    this.bag = bag
    this.autoWorkerCapacity = Math.max(0, Math.floor(options.autoWorkerCapacity))
    this.cycleMs = (options.cycleSeconds ?? DEFAULT_CYCLE_SECONDS) * 1000
    this.settings = { gradeFilter: 'all', qualityFilter: 'all', workers: 0 }
  }

  getSettings(): DecomposeSettings {
    return { ...this.settings }
  }

  setSetting(patch: Partial<DecomposeSettings>): void {
    this.settings = {
      gradeFilter: patch.gradeFilter ?? this.settings.gradeFilter,
      qualityFilter: patch.qualityFilter ?? this.settings.qualityFilter,
      workers: Math.min(
        Math.max(0, Math.floor(patch.workers ?? this.settings.workers)),
        this.autoWorkerCapacity,
      ),
    }
  }

  /**
   * Tick theo thời gian thực (nowMs). Đủ chu kỳ và workers > 0 → chạy
   * MỘT lượt phân giải (catch-up một lượt nếu trễ nhiều — idle-friendly,
   * không nhân burst).
   */
  tick(nowMs: number): void {
    if (this.settings.workers <= 0) {
      this.started = false

      return
    }

    if (!this.started) {
      this.started = true
      // Chu kỳ ĐẦU hoàn thành tại nowMs + cycleMs — tick giữa chừng
      // (0 → 29_999s) chưa đủ một lượt.
      this.nextCycleAt = nowMs + this.cycleMs

      return
    }

    if (nowMs < this.nextCycleAt) {
      return
    }

    // Catch-up một lượt (idle không burst) — lượt tiếp theo từ hiện tại.
    const missedCycles = Math.min(
      Math.floor((nowMs - this.nextCycleAt) / this.cycleMs) + 1,
      1,
    )

    this.nextCycleAt = this.nextCycleAt + missedCycles * this.cycleMs

    this.runOneCycle()
  }

  drainOutput(): DecomposeOutputEntry[] {
    const drained = this.pendingOutput

    this.pendingOutput = []

    return drained
  }

  private runOneCycle(): void {
    const { gradeFilter, qualityFilter, workers } = this.settings

    const targetConsumed = workers * ORE_PER_WORKER_PER_CYCLE

    let consumed = 0
    let outputAmount = 0

    for (const stack of this.bag.getAll()) {
      if (consumed >= targetConsumed) {
        break
      }

      const match = this.oreMatchesFilter(stack.material.id, gradeFilter, qualityFilter)

      if (!match) {
        continue
      }

      const take = Math.min(stack.amount, targetConsumed - consumed)

      if (take <= 0) {
        continue
      }

      if (!this.bag.remove(stack.material.id, take)) {
        continue
      }

      consumed += take
      outputAmount += this.outputForOre(stack.material.id, take, workers)
    }

    if (outputAmount > 0) {
      this.pendingOutput.push({ materialId: LUYEN_KHI_TINH_HOA_ID, amount: outputAmount })
    }
  }

  /** Output = floor(consumed/target × base(grade) × hệ_số(quality) × workers). */
  private outputForOre(oreId: string, consumed: number, workers: number): number {
    const { quality, grade } = parseOre(oreId)

    const target = workers * ORE_PER_WORKER_PER_CYCLE

    const gradeIndex = PROFESSION_GRADE_ORDER.indexOf(grade)

    const base = 1 + Math.max(0, gradeIndex) * 0.5

    const qualityIndex = ITEM_QUALITY_ORDER.indexOf(quality)

    const qualityFactor = 2 ** Math.max(0, qualityIndex)

    const fullOutput = base * qualityFactor * workers

    // Fairness ceil — phần khoáng lẻ không bị浪费.
    return Math.ceil((consumed / target) * fullOutput)
  }

  private oreMatchesFilter(
    oreId: string,
    gradeFilter: ProfessionGrade | 'all',
    qualityFilter: ItemQuality | 'all',
  ): boolean {
    const parsed = parseOre(oreId)

    if (!parsed) {
      return false
    }

    if (gradeFilter !== 'all' && parsed.grade !== gradeFilter) {
      return false
    }

    if (qualityFilter !== 'all' && parsed.quality !== qualityFilter) {
      return false
    }

    return true
  }
}

/** `<realmId>_ore_<quality>` → { grade, quality } | null. */
export function parseOre(oreId: string): { grade: ProfessionGrade; quality: ItemQuality } | null {
  const match = /^(.+)_ore_(hoang|huyen|dia|thien|tien)$/.exec(oreId)

  if (!match) {
    return null
  }

  const grade = PROFESSION_GRADE_BY_REALM[match[1]!]

  if (!grade) {
    return null
  }

  return { grade, quality: match[2] as ItemQuality }
}
