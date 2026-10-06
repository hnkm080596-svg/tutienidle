// Task 14 (rework P4, 2026-09-01, spec item-grade-quality-model sec5.6) -
// Tab Phan Giai engine: phan giai Linh Khoang thanh Luyen Khi Tinh Hoa.
//
// Nguyen tac (user-approved):
// - Nguon DUY NHAT cua tinh hoa ngoai Hoa Luyen trang bi.
// - Settings nguoi choi: loc pham, loc chat, so nhan cong (pool chung,
//   capacity do GameManager cap - pattern autoWorkerCapacity).
// - Chay nhu production cycle (tick theo nowMs, khong instant) - khop
//   kien truc ProductionSystem va quy tac can bang 6F per-worker.
// - Output tuyen tinh: base(grade) x he_so(age) x workers.
//   base = 1 + gradeIndex x 0.5; he so tuoi = 2^ageIndex.
//   (Khoi diem - tuning sau playtest theo 6F "san xuat <= tieu thu
//   tren moi nhan cong, cung pham cung chat".)
//
// Ore id convention (gp123 6E C2): `<realmId>_ore_<age>` (age in
// decade..thuong_co - materials.ts generator truc tuoi thong nhat).
// Grade cua ore suy tu realmId qua PROFESSION_GRADE_BY_REALM.
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
import { isScopeHidden } from '../betaScope'

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

/** Khoang tieu thu moi worker moi luot. */
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

  /**
   * BETA SCOPE LOCK v2 sec.11 - the consumer-facing settings read model.
   * While equipmentOreDecompose is scope-hidden the worker claim reports 0
   * so the shared worker pool (resolveProductionWorkerCapacity, fed from
   * this accessor every tick) routes the WHOLE capacity to production.
   * Persistence is unaffected: getSaveState reads the raw `this.settings`.
   */
  getSettings(): DecomposeSettings {
    if (isScopeHidden('equipmentOreDecompose')) {
      return { ...this.settings, workers: 0 }
    }

    return { ...this.settings }
  }

  setSetting(patch: Partial<DecomposeSettings>): void {
    // BETA SCOPE LOCK v2 - hidden tab writes fail closed (direct API too).
    if (isScopeHidden('equipmentOreDecompose')) {
      return
    }

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
   * ui-audit economy M5 - read-only snapshot of which bag stacks the
   * CURRENT filters match. DecomposeTab uses it for the matching-ore
   * list + empty-state copy so the UI never re-implements the filter
   * (A9: oreMatchesFilter stays the single implementation).
   */
  listMatchingOres(): DecomposeOutputEntry[] {
    // BETA SCOPE LOCK v2 - the hidden tab's query fails closed as well.
    if (isScopeHidden('equipmentOreDecompose')) {
      return []
    }

    return this.bag
      .getAll()
      .filter((stack) =>
        this.oreMatchesFilter(stack.material.id, this.settings.gradeFilter, this.settings.ageFilter),
      )
      .map((stack) => ({ materialId: stack.material.id, amount: stack.amount }))
  }

  /**
   * Tick theo thoi gian thuc (nowMs). Du chu ky va workers > 0 -> chay
   * MOT luot phan giai (catch-up mot luot neu tre nhieu - idle-friendly,
   * khong nhan burst).
   */
  tick(nowMs: number): void {
    // BETA SCOPE LOCK v2 - the cycle engine never runs while the tab is
    // scope-hidden; restored `started`/`nextCycleAt` state is left intact.
    if (isScopeHidden('equipmentOreDecompose')) {
      return
    }

    // r29-COR-F1: nowMs guard parity with advanceWorkerLanes /
    // AlchemySystem.tick - a non-finite or out-of-domain
    // clock mints a cycle (NaN < nextCycleAt is false -> catch-up arm)
    // AND poisons nextCycleAt into a write-gate wedge. Zero-advance
    // preserves state untouched (deny direction).
    // r30-AUT-3: [0, 2^52) persisted-clock domain.
    // r31-COR-F-HEADROOM: every mint below writes nextCycleAt =
    // nowMs + cycleMs - a clock within cycleMs of the bound stamps a
    // due the next save write self-refuses (wedge). The !(...) form
    // denies NaN cycleMs as well.
    if (
      !Number.isFinite(nowMs) ||
      nowMs < 0 ||
      !(nowMs + Math.max(0, this.cycleMs) < 2 ** 52)
    ) {
      return
    }

    if (this.settings.workers <= 0) {
      this.started = false

      return
    }

    if (!this.started) {
      this.started = true
      // Chu ky DAU hoan thanh tai nowMs + cycleMs - tick giua chung
      // (0 -> 29_999s) chua du mot luot.
      this.nextCycleAt = nowMs + this.cycleMs

      return
    }

    if (nowMs < this.nextCycleAt) {
      // Mission A review (MA-R3-02): no legit writer emits a deadline
      // further than one cycle out - a stale/crafted far-future value
      // would stall decompose indefinitely, so rebase instead.
      if (this.nextCycleAt - nowMs > this.cycleMs) {
        this.nextCycleAt = nowMs + this.cycleMs
      }

      return
    }

    // Catch-up mot luot (idle khong burst) - luot tiep theo tu hien tai.
    // MA-R3-01: rebase to now + cycleMs, not nextCycleAt + cycleMs -
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
   * M1 (ARCH-001) - an absent slice (`undefined`, old saves without the
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
  restore(state: DecomposeSaveState | undefined, restoreNowMs: number = Date.now()): void {
    const source: DecomposeSaveState = state ?? {
      settings: { gradeFilter: 'all', ageFilter: 'all', workers: 0 },
      nextCycleAt: 0,
      started: false,
    }

    // Mission A3 defense-in-depth: the shape validator owns rejection,
    // but a bypassed payload must still not poison the timer or the
    // per-cycle consumption math (NaN nextCycleAt = per-tick runaway,
    // NaN workers = NaN target inside runOneCycle). A null settings
    // sub-object would throw on property read - fall back to defaults.
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
    // r26-AUT-3: re-anchor like autofarm.lastCheckedMs - an authored
    // next-cycle can sit at most one cycleMs past the restore clock
    // (it was stamped at last fire + cycleMs, fire <= marker <= now),
    // so anything beyond restore-now + cycleMs is impossible content,
    // not a deadline. Without the cap a crafted future stamp idles the
    // channel until Delta and self-bricks every save write past it;
    // the tick already rebases the same way (:177-178).
    // r29-COR-F1: the re-anchor only runs under a sane restore clock -
    // a non-finite or huge restoreNowMs collapses the min() bound to
    // NaN/garbage and poisons nextCycleAt into a write-gate wedge. Bad
    // clock -> merge the restored deadline verbatim: a crafted-future
    // stamp stays parked (deny), honest stamps merge the same way.
    // r30-AUT-3: tightened to [0, 2^52) - a negative re-anchor
    // deep-pasts the deadline (next settle mints), and >= 2^52
    // self-refuses the next save write.
    const clockOk = Number.isFinite(restoreNowMs) && restoreNowMs >= 0 && restoreNowMs < 2 ** 52
    if (Number.isFinite(restoredDeadline)) {
      const mergedDeadline = clockOk
        ? Math.min(Math.max(0, restoredDeadline), restoreNowMs + this.cycleMs)
        : Math.max(0, restoredDeadline)
      this.nextCycleAt = Math.max(this.nextCycleAt, mergedDeadline)
    }
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
    // BETA SCOPE LOCK v2 - offline cycles cannot accrue while hidden.
    if (isScopeHidden('equipmentOreDecompose')) {
      return 0
    }

    // r29-COR-F1: nowMs guard parity - nowMs=+Infinity spins the
    // settle loop up to the 5000-cycle bound; zero-settle under a
    // broken clock (deny). r30-AUT-3: [0, 2^52) persisted-clock domain.
    // r31-COR-F-HEADROOM: the fast-forward and settle-loop writes
    // advance nextCycleAt to at most nowMs + cycleMs - the same
    // headroom keeps the persisted stamp inside the admitted domain.
    if (
      !Number.isFinite(nowMs) ||
      nowMs < 0 ||
      !(nowMs + Math.max(0, this.cycleMs) < 2 ** 52)
    ) {
      return 0
    }

    // r30-AUT-1: the sibling window input needs the same guard - a NaN
    // offlineSinceMs collapses windowStartMs to NaN, which SKIPS the
    // confiscation fast-forward (nextCycleAt <= NaN is false) and pays
    // the whole deep-past backlog up to the 5000-cycle bound. Parity
    // with the workerLane/auto-farm window guards: zero-settle.
    // r30-AUT-3: same [0, 2^52) domain as the clock seams.
    if (!Number.isFinite(offlineSinceMs) || offlineSinceMs < 0 || offlineSinceMs >= 2 ** 52) {
      return 0
    }

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
    // r12-INT: bound the fast-forward at nowMs - deadlines past now are
    // still pending, and a crafted-future offlineSinceMs paired with a
    // crafted-old nextCycleAt would otherwise spin billions of no-op
    // iterations at boot.
    // r21-COR-4: O(1) jump arithmetic instead of per-cycle stepping -
    // a crafted nextCycleAt=0 still admitted by the non-negative pin
    // used to spin ~57M no-op iterations (~156ms) every boot.
    const fastForwardEndMs = Math.min(windowStartMs, nowMs)
    if (this.cycleMs > 0 && this.nextCycleAt <= fastForwardEndMs) {
      const skippedCycles =
        Math.floor((fastForwardEndMs - this.nextCycleAt) / this.cycleMs) + 1
      this.nextCycleAt += skippedCycles * this.cycleMs
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

  /** Output = floor(consumed/target x base(grade) x he_so(age) x workers). */
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

    // Fairness ceil - phan khoang le khong bi.
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

// Regex bien dich MOT LAN - parseOre chay moi stack moi tick phan giai.
// Inverse of buildProfessionMaterialId('ore', realm, age) - the
// constructor in ProfessionMaterial.ts owns this grammar.
const ORE_ID_PATTERN = new RegExp(`^(.+)_ore_(${HERB_AGES.join('|')})$`)

/** `<realmId>_ore_<age>` -> { grade, age } | null (gp123 6E C2: truc tuoi). */
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
