import type { MaterialBag } from '../material/MaterialBag'
import type { MaterialRegistry } from '../material/MaterialRegistry'
import type {
  ProductionCycle,
  ProductionSiteDefinition,
  ProductionSiteState,
} from './ProductionTypes'
import {
  CYCLE_BASE_SECONDS_BY_REALM,
  PRODUCTION_OFFLINE_CAP_SECONDS,
  computeCycleSeconds,
} from './ProductionBalance'
import { allocateWorkerSlots } from './WorkerAllocator'
import { advanceWorkerLanes } from './WorkerLaneAdvance'

/**
 * Offline settle (plan §4.3) — tach khoi ProductionSystem
 * (large-file-split): policy catch-up (ngan sach PRODUCTION_OFFLINE_CAP,
 * forfeit backlog, worker-cycle window) song hanh voi tickWorkers
 * online qua CUNG allocateWorkerSlots + grantCycleRewards — online va
 * offline dung mot quy tac phan bo/settle.
 *
 * M11 (ARCH-007): worker-cycle advancement dung CUNG mechanism
 * advanceWorkerLanes (WorkerLaneAdvance.ts) voi tickWorkers — per-lane
 * deadline chaining thay cho pooling floor(windowMs * slots / cycleMs).
 */
export interface ProductionOfflineDeps {
  states: Map<string, ProductionSiteState>

  getSiteDefinition: (siteId: string) => ProductionSiteDefinition | undefined

  canStart: (siteId: string) => boolean

  startCycle: (siteId: string, collectionRealmId: string, nowMs: number) => boolean

  grantCycleRewards: (
    cycle: ProductionCycle,
    bag: MaterialBag,
    registry: MaterialRegistry,
  ) => void
}

export interface ProductionOfflineOptions {
  workerCapacity?: number
  offlineSinceMs?: number
  /** Chi-hien-quan — assignments snapshot (từ states trước settle) để
   *  offline khớp online. */
  workerAssignments?: Map<string, number>
}

export function settleProductionOffline(
  deps: ProductionOfflineDeps,
  bag: MaterialBag,
  registry: MaterialRegistry,
  currentRealmId: string,
  nowMs: number = Date.now(),
  options: ProductionOfflineOptions = {},
): number {
  let budgetRemainingMs = PRODUCTION_OFFLINE_CAP_SECONDS * 1000

  let settled = 0

  let guard = 0

  while (guard < 5000) {
    guard += 1

    // Tìm cycle hoàn thành SỚM NHẤT trong quá khứ của nowMs.
    let targetState: ProductionSiteState | undefined

    let targetCycle: ProductionCycle | undefined

    for (const state of deps.states.values()) {
      const cycle = state.activeCycle

      if (!cycle || cycle.completesAtMs > nowMs) {
        continue
      }

      if (!targetCycle || cycle.completesAtMs < targetCycle.completesAtMs) {
        targetState = state

        targetCycle = cycle
      }
    }

    if (!targetState || !targetCycle) {
      break
    }

    const durationMs = Math.max(0, targetCycle.completesAtMs - targetCycle.startedAtMs)

    if (durationMs > budgetRemainingMs) {
      break
    }

    budgetRemainingMs -= durationMs

    targetState.activeCycle = undefined

    deps.grantCycleRewards(targetCycle, bag, registry)

    settled += 1

    if (targetState.autoRestart && deps.canStart(targetCycle.siteId)) {
      deps.startCycle(targetCycle.siteId, currentRealmId, targetCycle.completesAtMs)
    }
  }

  // Huỷ backlog manual hết ngân sách (xem JSDoc).
  for (const state of deps.states.values()) {
    const cycle = state.activeCycle

    if (!cycle || cycle.completesAtMs > nowMs) {
      continue
    }

    state.activeCycle = undefined

    if (state.autoRestart) {
      deps.startCycle(state.siteId, currentRealmId, nowMs)
    }
  }

  settled += settleWorkersOffline(
    deps,
    bag,
    registry,
    currentRealmId,
    nowMs,
    budgetRemainingMs,
    Math.floor(options.workerCapacity ?? 0),
    options.offlineSinceMs,
    options.workerAssignments,
  )

  return settled
}

/**
 * Offline settle cho worker cycles (T3) — chia ngân sách còn lại sau
 * manual settle. Mỗi site có `slots` LANE worker chạy song song trong
 * cửa sổ [offlineSinceMs, nowMs], mỗi lane một chuỗi cycle nối tiếp với
 * deadline RIÊNG (M11/ARCH-007 — cùng mechanism advanceWorkerLanes với
 * tickWorkers, driver 'deadline'). Cycle dở dang vượt nowMs được giữ lại
 * nguyên deadline/lane cho tickWorkers online; cycle hoàn thành mà hết
 * ngân sách bị forfeit. Không gộp phần lẻ giữa các lane thành cycle ảo.
 *
 * Chi-hien-quan (2026-09-02): `workerAssignments` — cùng phân bổ manual
 * của tickWorkers để OFFLINE KHỚP ONLINE (spec §6).
 */
function settleWorkersOffline(
  deps: ProductionOfflineDeps,
  bag: MaterialBag,
  registry: MaterialRegistry,
  currentRealmId: string,
  nowMs: number,
  budgetRemainingMs: number,
  workerCapacity: number,
  offlineSinceMs?: number,
  workerAssignments?: Map<string, number>,
): number {
  // R7 (AR-07): the SAME pure allocator as tickWorkers - online and
  // offline settlement share one distribution rule (manual first,
  // remainder round-robins unassigned sites, leftover idle).
  const activeStates = [...deps.states.values()].filter((state) => state.autoRestart)

  // Same order as tickWorkers: slots zero out on every state first.
  for (const state of deps.states.values()) {
    state.activeWorkerSlots = 0
  }

  // workerCapacity <= 0 mirrors the online early-return (tickWorkers
  // freezes workerCycles entirely when capacity is 0). Budget 0 must
  // STILL run: due cycles forfeit under the cap instead of lingering
  // past-due for a free online grant.
  if (activeStates.length === 0 || workerCapacity <= 0) {
    return 0
  }

  const slotsBySite = allocateWorkerSlots(
    activeStates.map((state) => state.siteId),
    workerAssignments ?? new Map<string, number>(),
    workerCapacity,
  )

  for (const state of activeStates) {
    state.activeWorkerSlots = slotsBySite.get(state.siteId) ?? 0
  }

  let settled = 0

  let budgetMs = budgetRemainingMs

  for (const state of activeStates) {
    const slots = slotsBySite.get(state.siteId) ?? 0

    const definition = deps.getSiteDefinition(state.siteId)

    const baseSeconds = CYCLE_BASE_SECONDS_BY_REALM[currentRealmId]

    const cycleMs =
      definition && baseSeconds ? computeCycleSeconds(baseSeconds, state.level) * 1000 : 0

    state.workerCycles ??= []

    // M11 (ARCH-007) — per-lane advancement qua CÙNG mechanism với
    // tickWorkers (advanceWorkerLanes): mỗi lane tự hoàn thành theo
    // deadline RIÊNG của nó; cycle dở dang giữ nguyên lane + deadline
    // gốc; lane trống chỉ chạy từ mốc save (offlineSinceMs). Không còn
    // floor(windowMs * slots / cycleMs) gộp phần lẻ giữa các lane.
    // Completions vượt ngân sách bị forfeit — backlog quá hạn không bao
    // giờ để lại cho tick online cấp miễn phí ngoài cap.
    const result = advanceWorkerLanes({
      siteId: state.siteId,
      collectionRealmId: currentRealmId,
      siteLevel: state.level,
      baseSeconds: baseSeconds ?? 0,
      cycleMs,
      pending: state.workerCycles,
      slots,
      nowMs,
      emptyLaneStartMs: offlineSinceMs,
      advanceMode: 'deadline',
      budgetMs,
    })

    state.workerCycles = result.pending

    budgetMs -= result.consumedBudgetMs

    for (const cycle of result.completed) {
      deps.grantCycleRewards(cycle, bag, registry)

      settled += 1
    }
  }

  return settled
}
