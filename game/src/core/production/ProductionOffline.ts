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
import { buildProductionCycle as buildCycle } from './ProductionCycles'

/**
 * Offline settle (plan §4.3) — tach khoi ProductionSystem
 * (large-file-split): policy catch-up (ngan sach PRODUCTION_OFFLINE_CAP,
 * forfeit backlog, worker-cycle window) song hanh voi tickWorkers
 * online qua CUNG allocateWorkerSlots + grantCycleRewards — online va
 * offline dung mot quy tac phan bo/settle. Hanh vi giu NGUYEN 1:1.
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
 * manual settle. Mỗi site có slot worker chạy các chuỗi cycle song song
 * nối tiếp nhau trong cửa sổ [offlineSinceMs, nowMs], mỗi cycle một
 * seed riêng. Cycle dở dang vượt nowMs được giữ lại cho tickWorkers
 * online; cycle hoàn thành mà hết ngân sách bị forfeit.
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
  if (workerCapacity <= 0 || budgetRemainingMs <= 0) {
    return 0
  }

  // R7 (AR-07): the SAME pure allocator as tickWorkers - online and
  // offline settlement share one distribution rule (manual first,
  // remainder round-robins unassigned sites, leftover idle).
  const activeStates = [...deps.states.values()].filter((state) => state.autoRestart)

  if (activeStates.length === 0) {
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

    if (slots <= 0 || budgetMs <= 0) {
      continue
    }

    const definition = deps.getSiteDefinition(state.siteId)

    const baseSeconds = CYCLE_BASE_SECONDS_BY_REALM[currentRealmId]

    if (!definition || !baseSeconds) {
      continue
    }

    const cycleMs = computeCycleSeconds(baseSeconds, state.level) * 1000

    if (cycleMs <= 0) {
      continue
    }

    state.workerCycles ??= []

    // 1) Settle cycle dở dang từ save hoàn thành trước nowMs, trong ngân sách.
    const kept: ProductionCycle[] = []

    let lastCompleteMs = offlineSinceMs ?? nowMs

    const pending = [...state.workerCycles].sort((a, b) => a.completesAtMs - b.completesAtMs)

    for (const cycle of pending) {
      if (cycle.completesAtMs > nowMs) {
        kept.push(cycle)

        continue
      }

      const durationMs = Math.max(0, cycle.completesAtMs - cycle.startedAtMs)

      if (durationMs > budgetMs) {
        continue
      }

      budgetMs -= durationMs

      deps.grantCycleRewards(cycle, bag, registry)

      settled += 1

      lastCompleteMs = Math.max(lastCompleteMs, cycle.completesAtMs)
    }

    state.workerCycles = kept

    // 2) Chạy nối tiếp các cycle mới trong cửa sổ offline còn lại —
    // `slots` chuỗi song song từ lastCompleteMs tới nowMs, tổng thời
    // gian sản xuất bị chặn bởi ngân sách còn lại. Mỗi cycle một seed
    // riêng (buildCycle).
    const windowMs = Math.max(0, nowMs - lastCompleteMs)

    const cyclesInWindow = Math.floor((windowMs * slots) / cycleMs)

    const affordableCycles = Math.floor(budgetMs / cycleMs)

    const newCycles = Math.max(0, Math.min(affordableCycles, cyclesInWindow))

    for (let index = 0; index < newCycles; index++) {
      const startMs = nowMs - (index + 1) * cycleMs

      const cycle = buildCycle(state.siteId, currentRealmId, state.level, baseSeconds, startMs)

      budgetMs -= cycleMs

      deps.grantCycleRewards(cycle, bag, registry)

      settled += 1
    }
  }

  return settled
}
