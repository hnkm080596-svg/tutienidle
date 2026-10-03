// QA FIXPOINT probe (blind lane authority, run qa-fixpoint-master) -
//
// F-WC-LANES (Medium): the productionSites workerCycles lane bound
// replayed the AUTHORED chi_hien_quan ceiling (1 + level*2 -> 19 lanes
// per site) while the beta scope lock keeps manualWorkforce hidden.
// Every live capacity consumer reads the flat auto pool via
// betaEffectiveWorkerCapacity (BETA_BASELINE_WORKER_CAPACITY = 3, one
// lane per Thanh Van site), so a site holding more in-flight lanes
// than the effective pool mints reward settles no writer can spawn.
//
// The canonical all-false beta table is re-pinned by
// lockBeta*ForTests() - the global vitest setup starts every suite
// with the full catalog admitted.
import { describe, expect, it } from 'vitest'
import { lockBetaFeaturesForTests } from '../../core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaWaysForTests } from '../../core/game/__fixtures__/betaWaysUnlock'
import { lockBetaTalentsForTests } from '../../core/game/__fixtures__/betaTalentsUnlock'

lockBetaFeaturesForTests()
lockBetaWaysForTests()
lockBetaTalentsForTests()

import { validateGameSaveShape } from './saveShapeValidation'
import { CURRENT_SAVE_VERSION } from './saveVersion'
import { createDefaultPlayer } from '../../core/player/Player'
import { isScopeHidden } from '../../core/betaScope'
import {
  BETA_BASELINE_WORKER_CAPACITY,
  betaEffectiveWorkerCapacity,
} from '../../core/production/WorkerCapacity'
import {
  CYCLE_BASE_SECONDS_BY_REALM,
  computeCycleSeconds,
} from '../../core/production/ProductionBalance'
import { THANH_VAN_PRODUCTION_SITES } from '../../core/production/ProductionCatalog'

const SITE = THANH_VAN_PRODUCTION_SITES[0]!

function validSave(): Record<string, unknown> {
  return {
    version: CURRENT_SAVE_VERSION,
    player: createDefaultPlayer(),
    techniques: [],
    skills: [],
    materials: [],
    equipment: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    equipmentSlots: [],
  }
}

// Writer-legal lane head: span replays the authored mortal cycle
// window at site level 1 (F-TC10-WC bound), realm pin at the player's
// own realm, start inside the save window.
function cycle(cycleId: string, startedAtMs: number): Record<string, unknown> {
  const spanMs =
    computeCycleSeconds(CYCLE_BASE_SECONDS_BY_REALM['mortal'] ?? 100, 1) * 1000

  return {
    cycleId,
    siteId: SITE.siteId,
    collectionRealmId: 'mortal',
    siteLevelAtStart: 1,
    rewardTableVersion: 1,
    rollSeed: 1,
    startedAtMs,
    completesAtMs: startedAtMs + spanMs,
  }
}

function siteWithLanes(count: number): Record<string, unknown> {
  return {
    siteId: SITE.siteId,
    level: 1,
    autoRestart: true,
    workerCycles: Array.from({ length: count }, (_, i) => cycle(`lane-${i}`, i + 1)),
  }
}

function pathsOf(result: ReturnType<typeof validateGameSaveShape>): string[] {
  return result.issues.map((issue) => issue.path)
}

describe('F-WC-LANES: the lane bound reads the producible beta pool, not the authored CHQ ceiling', () => {
  it('precondition: manualWorkforce is scope-hidden - every capacity consumer sees the flat baseline pool', () => {
    expect(isScopeHidden('manualWorkforce')).toBe(true)
    expect(betaEffectiveWorkerCapacity(19)).toBe(BETA_BASELINE_WORKER_CAPACITY)
  })

  it('a site carrying more lanes than the effective pool is rejected even under the authored ceiling', () => {
    // 4 lanes sat under the old authored 19-lane bound yet exceed the
    // producible pool (3): an impossible writer output.
    const save = validSave()
    ;(save as Record<string, unknown>).productionSites = [
      siteWithLanes(BETA_BASELINE_WORKER_CAPACITY + 1),
    ]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('productionSites[0].workerCycles')
  })

  it('a site holding exactly the effective pool validates', () => {
    const save = validSave()
    ;(save as Record<string, unknown>).productionSites = [
      siteWithLanes(BETA_BASELINE_WORKER_CAPACITY),
    ]

    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  it('a single lane validates', () => {
    const save = validSave()
    ;(save as Record<string, unknown>).productionSites = [siteWithLanes(1)]

    expect(validateGameSaveShape(save).ok).toBe(true)
  })
})
