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

let fallbackCycleCounter = 0

function nextFallbackCycleId(siteId: string, nowMs: number): string {
  fallbackCycleCounter += 1
  const stamp = Number.isFinite(nowMs) ? Math.floor(Math.max(0, nowMs)).toString(36) : '0'
  return `cycle_${siteId}_${stamp}_${fallbackCycleCounter}`
}

export function buildProductionCycle(
  siteId: string,
  collectionRealmId: string,
  siteLevelAtStart: number,
  baseSeconds: number,
  nowMs: number,
  rng?: () => number,
  issueIdentity?: () => { cycleId: string; receiptOrdinal: number },
): ProductionCycle {
  const seconds = computeCycleSeconds(baseSeconds, siteLevelAtStart)

  return {
    ...(issueIdentity?.() ?? { cycleId: nextFallbackCycleId(siteId, nowMs) }),
    siteId,
    collectionRealmId,
    siteLevelAtStart,
    rewardTableVersion: REWARD_TABLE_VERSION,
    rollSeed: Math.floor((rng?.() ?? Math.random()) * 0x7fffffff),
    startedAtMs: nowMs,
    completesAtMs: nowMs + seconds * 1000,
  }
}
