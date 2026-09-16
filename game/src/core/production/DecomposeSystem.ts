// Task 14 (rework P4, 2026-09-01, spec item-grade-quality-model §5.6) —
// Tab Phân Giải engine: phân giải Linh Khoáng thành Luyện Khí Tinh Hoa.
//
// Nguyên tắc (user-approved):
// - Nguồn DUY NHẤT của tinh hoa ngoài Hóa Luyện trang bị.
// - Settings người chơi: lọc phẩm, lọc chất, số nhân công (pool chung,
//   capacity do GameManager cấp — pattern autoWorkerCapacity).
// - Chạy như production cycle (tick theo nowMs, không instant) — khớp
//   kiến trúc ProductionSystem và quy tắc cân bằng 6F per-worker.
// - Output tuyến tính: base(grade) × hệ_số(age) × workers.
//   base = 1 + gradeIndex × 0.5; hệ số tuổi = 2^ageIndex.
//   (Khởi điểm — tuning sau playtest theo 6F "sản xuất ≤ tiêu thụ
//   trên mỗi nhân công, cùng phẩm cùng chất".)
//
// Ore id convention (gp123 6E C2): `<realmId>_ore_<age>` (age ∈
// decade..thuong_co — materials.ts generator trục tuổi thống nhất).
// Grade của ore suy từ realmId qua PROFESSION_GRADE_BY_REALM.
import { LUYEN_KHI_TINH_HOA_ID } from '../equipment/TinhHoaMaterial'
import { HERB_AGES } from './ProductionTypes'
import type { HerbAge } from './ProductionTypes'
import {
  PROFESSION_GRADE_ORDER,
  PROFESSION_GRADE_BY_REALM,
  type ProfessionGrade,
} from '../profession/ProfessionGrade'
import type { MaterialBag } from '../material/MaterialBag'
import { PRODUCTION_OFFLINE_CAP_SECONDS } from './ProductionBalance'

export interface DecomposeSettings {
  gradeFilter: ProfessionGrade | 'all'
  ageFilter: HerbAge | 'all'
  workers: number
}

export interface DecomposeOutputEntry {
  materialId: string
  amount: number
}

export interface DecomposeSystemOptions {
  cycleSeconds?: number
}

/** R7 (AR-08) - detached persistence slice for GameSave. */
export interface DecomposeSaveState {
  settings: DecomposeSettings
  nextCycleAt: number
  started: boolean
}

const DEFAULT_CYCLE_SECONDS = 30

/** Khoáng tiêu thụ mỗi worker mỗi lượt. */
const ORE_PER_WORKER_PER_CYCLE = 2

export class DecomposeSystem {
  private readonly bag: MaterialBag

  // R7 (AR-08): live capacity supplied by the workforce authority
  // (GameManager tick / restore) - NOT a constructor constant.
  private capacity = 0

  private readonly cycleMs: number

  private settings: DecomposeSettings

  private nextCycleAt = 0

  private started = false

  private pendingOutput: DecomposeOutputEntry[] = []

  constructor(bag: MaterialBag, options: DecomposeSystemOptions = {}) {
    this.bag = bag
    this.cycleMs = (options.cycleSeconds ?? DEFAULT_CYCLE_SECONDS) * 1000
    this.settings = { gradeFilter: 'all', ageFilter: 'all', workers: 0 }
  }

  /** Live capacity from the workforce authority (GameManager per tick). */
  updateCapacity(capacity: number): void {
    this.capacity = Math.max(0, Math.floor(capacity))

    // Shrink case: a CHQ downgrade or stale save must not leave workers
    // above the new ceiling.
    if (this.settings.workers > this.capacity) {
      this.settings.workers = this.capacity
    }
  }

  getCapacity(): number {
    return this.capacity
  }

  getSettings(): DecomposeSettings {
    return { ...this.settings }
  }

  setSetting(patch: Partial<DecomposeSettings>): void {
    this.settings = {
      gradeFilter: patch.gradeFilter ?? this.settings.gradeFilter,
      ageFilter: patch.ageFilter ?? this.settings.ageFilter,
      workers: Math.min(
        Math.max(0, Math.floor(patch.workers ?? this.settings.workers)),
        this.capacity,
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
      // Mission A review (MA-R3-02): no legit writer emits a deadline
      // further than one cycle out — a stale/crafted far-future value
      // would stall decompose indefinitely, so rebase instead.
      if (this.nextCycleAt - nowMs > this.cycleMs) {
        this.nextCycleAt = nowMs + this.cycleMs
      }

      return
    }

    // Catch-up một lượt (idle không burst) — lượt tiếp theo từ hiện tại.
    // MA-R3-01: rebase to now + cycleMs, not nextCycleAt + cycleMs —
    // the old form advanced a late deadline by only one cycle, so a
    // long-ago deadline replayed the whole backlog one run per tick
    // (a burst spread across frames). Offline backlog belongs to
    // settleOffline(); the online tick never replays.
    this.nextCycleAt = nowMs + this.cycleMs

    this.runOneCycle()
  }

  drainOutput(): DecomposeOutputEntry[] {
    const drained = this.pendingOutput

    this.pendingOutput = []

    return drained
  }

  /**
   * R7 (AR-08) - detached snapshot for GameSave. A value at a point in
   * time: mutating the live system after this call must not change the
   * snapshot (A3).
   */
  getSaveState(): DecomposeSaveState {
    return {
      settings: { ...this.settings },
      nextCycleAt: this.nextCycleAt,
      started: this.started,
    }
  }

  /**
   * R7 (AR-08) - restore a snapshot produced by getSaveState.
   * Restored workers clamp to the CURRENT capacity (a stale save must
   * not resurrect workers above the live CHQ ceiling).
   *
   * M1 (ARCH-001) — an absent slice (`undefined`, old saves without the
   * field) resets to DEFAULTS like every other owner instead of keeping
   * the previous session's settings.
   *
   * Repeat-application contract (A3 / QA-2026-09-08-R7-001): the cycle
   * timer MERGES with the live state instead of rewinding it. A first
   * restore into a fresh instance takes the saved deadline; restoring
   * the SAME payload again into an instance that already settled that
   * window keeps the advanced timer, so the offline settle cannot
   * award twice.
   */
  restore(state: DecomposeSaveState | undefined): void {
    const source: DecomposeSaveState = state ?? {
      settings: { gradeFilter: 'all', ageFilter: 'all', workers: 0 },
      nextCycleAt: 0,
      started: false,
    }

    // Mission A3 defense-in-depth: the shape validator owns rejection,
    // but a bypassed payload must still not poison the timer or the
    // per-cycle consumption math (NaN nextCycleAt = per-tick runaway,
    // NaN workers = NaN target inside runOneCycle). A null settings
    // sub-object would throw on property read — fall back to defaults.
    const sourceSettings =
      typeof source.settings === 'object' && source.settings !== null
        ? source.settings
        : { gradeFilter: 'all' as const, ageFilter: 'all' as const, workers: 0 }
    const restoredWorkers = sourceSettings.workers ?? 0
    const restoredDeadline = Math.floor(source.nextCycleAt ?? 0)

    this.settings = {
      gradeFilter: sourceSettings.gradeFilter ?? 'all',
      ageFilter: sourceSettings.ageFilter ?? 'all',
      workers: Number.isFinite(restoredWorkers)
        ? Math.min(Math.max(0, Math.floor(restoredWorkers)), this.capacity)
        : 0,
    }
    this.nextCycleAt = Number.isFinite(restoredDeadline)
      ? Math.max(this.nextCycleAt, Math.max(0, restoredDeadline))
      : this.nextCycleAt
    this.started = this.started || Boolean(source.started)
  }

  /**
   * R7 (AR-08, user-approved offline settle) - bounded catch-up over
   * [offlineSinceMs, nowMs]: settle every cycle whose deadline fell
   * inside the window capped at PRODUCTION_OFFLINE_CAP_SECONDS, the
   * SAME economy cap concept as production offline settlement. Ore
   * stock bounds the run naturally (runOneCycle consumes the bag).
   *
   * Idempotent per window: cycles already settled advance
   * nextCycleAt, so a repeated call over the same window settles 0.
   */
  settleOffline(nowMs: number, offlineSinceMs: number): number {
    if (this.settings.workers <= 0 || !this.started) {
      return 0
    }

    // The settle window starts at the latest of: restored timer,
    // offline-since marker, or (cap - window) back from now.
    const windowStartMs = Math.max(
      this.nextCycleAt - this.cycleMs,
      Math.floor(offlineSinceMs),
      nowMs - PRODUCTION_OFFLINE_CAP_SECONDS * 1000,
    )

    // Fast-forward deadlines that predate the settle window: they are
    // forfeited, not replayed (timer still advances - a repeated call
    // over the same window settles nothing twice).
    while (this.nextCycleAt <= windowStartMs) {
      this.nextCycleAt += this.cycleMs
    }

    let settled = 0

    // Bounded loop (5000 cycles = 41+ hours at 30s - far beyond the
    // offline cap; the guard only protects against corrupt timers).
    while (this.nextCycleAt <= nowMs && settled < 5000) {
      this.runOneCycle()
      settled += 1
      this.nextCycleAt += this.cycleMs
    }

    return settled
  }

  private runOneCycle(): void {
    const { gradeFilter, ageFilter, workers } = this.settings

    const targetConsumed = workers * ORE_PER_WORKER_PER_CYCLE

    let consumed = 0
    let outputAmount = 0

    for (const stack of this.bag.getAll()) {
      if (consumed >= targetConsumed) {
        break
      }

      const match = this.oreMatchesFilter(stack.material.id, gradeFilter, ageFilter)

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

  /** Output = floor(consumed/target × base(grade) × hệ_số(age) × workers). */
  private outputForOre(oreId: string, consumed: number, workers: number): number {
    const parsed = parseOre(oreId)

    if (!parsed) {
      return 0
    }

    const { age, grade } = parsed

    const target = workers * ORE_PER_WORKER_PER_CYCLE

    const gradeIndex = PROFESSION_GRADE_ORDER.indexOf(grade)

    const base = 1 + Math.max(0, gradeIndex) * 0.5

    const ageIndex = HERB_AGES.indexOf(age)

    const ageFactor = 2 ** Math.max(0, ageIndex)

    const fullOutput = base * ageFactor * workers

    // Fairness ceil — phần khoáng lẻ không bị浪费.
    return Math.ceil((consumed / target) * fullOutput)
  }

  private oreMatchesFilter(
    oreId: string,
    gradeFilter: ProfessionGrade | 'all',
    ageFilter: HerbAge | 'all',
  ): boolean {
    const parsed = parseOre(oreId)

    if (!parsed) {
      return false
    }

    if (gradeFilter !== 'all' && parsed.grade !== gradeFilter) {
      return false
    }

    if (ageFilter !== 'all' && parsed.age !== ageFilter) {
      return false
    }

    return true
  }
}

// Regex biên dịch MỘT LẦN — parseOre chạy mỗi stack mỗi tick phân giải.
const ORE_ID_PATTERN = new RegExp(`^(.+)_ore_(${HERB_AGES.join('|')})$`)

/** `<realmId>_ore_<age>` → { grade, age } | null (gp123 6E C2: trục tuổi). */
export function parseOre(oreId: string): { grade: ProfessionGrade; age: HerbAge } | null {
  const match = ORE_ID_PATTERN.exec(oreId)

  if (!match) {
    return null
  }

  const grade = PROFESSION_GRADE_BY_REALM[match[1]!]

  if (!grade) {
    return null
  }

  return { grade, age: match[2] as HerbAge }
}
