/**
 * F-MG-14 (EM-01 class) - every BuildingInstance construction site must pin
 * accrualRealmId at creation. Without the pin a breakthrough before the
 * first claim reprices the whole backlog at the new realm's rate/tier.
 * Sites: BuildingSystem.build() (domain path), App.vue starter grant,
 * BuildingConstructionGate.vue dev grant. The save-time legacy fallback
 * (accrualRealmId ?? realm) exists only for old saves, never for
 * in-session construction.
 */
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { readTs, SCAN_TIMEOUT } from './helpers/scanTs'
import { readFileSync } from 'node:fs'

const GAME_ROOT = process.cwd()

describe('building accrualRealmId pin coverage', () => {
  it('BuildingSystem.build() pins the creation realm', { timeout: SCAN_TIMEOUT }, () => {
    const src = readTs(join(GAME_ROOT, 'src/core/building/BuildingSystem.ts'))
    expect(src.includes('accrualRealmId: player.realmId')).toBe(true)
  })

  it('every non-build() construction site pins accrualRealmId', { timeout: SCAN_TIMEOUT }, () => {
    for (const rel of ['src/App.vue', 'src/components/panels/BuildingConstructionGate.vue']) {
      const src = readFileSync(join(GAME_ROOT, rel), 'utf8')
      const adds = src.match(/buildingManager\.add\(/g) ?? []
      const pins = src.match(/accrualRealmId:/g) ?? []
      expect(
        pins.length,
        `${rel}: ${adds.length} buildingManager.add call(s) but only ${pins.length} accrualRealmId pin(s)`,
      ).toBeGreaterThanOrEqual(adds.length)
    }
  })
})
