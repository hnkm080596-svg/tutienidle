import type { ProductionCycle } from './ProductionTypes'
import { computeCycleSeconds } from './ProductionBalance'

// large-file-split - cycle factory duoc dung chung boi ProductionSystem
// (online start) va ProductionOffline.ts (offline catch-up); leaf module
// de tranh cycle giua 2 file do.

/**
 * Version bang reward hien hanh - bump khi doi balance data de cycle
 * dang chay van roll theo bang cu (snapshot sec4.1).
 */
export const REWARD_TABLE_VERSION = 1

let cycleCounter = 0

function nextCycleId(siteId: string): string {
  cycleCounter += 1

  return `cycle_${siteId}_${Date.now().toString(36)}_${cycleCounter}`
}

export function buildProductionCycle(
  siteId: string,
  collectionRealmId: string,
  siteLevelAtStart: number,
  baseSeconds: number,
  nowMs: number,
  rng?: () => number,
): ProductionCycle {
  const seconds = computeCycleSeconds(baseSeconds, siteLevelAtStart)

  return {
    cycleId: nextCycleId(siteId),
    siteId,
    collectionRealmId,
    siteLevelAtStart,
    rewardTableVersion: REWARD_TABLE_VERSION,
    rollSeed: Math.floor((rng?.() ?? Math.random()) * 0x7fffffff),
    startedAtMs: nowMs,
    completesAtMs: nowMs + seconds * 1000,
  }
}
