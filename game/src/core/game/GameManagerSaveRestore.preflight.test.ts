// R10 (AR-12, S4) — preflight coverage. Before this repair,
// preflightSaveRegistryReferences() only validated equipment/affix
// references; save.materials/save.pills/save.buildings with an unknown
// (removed-from-registry) ID were silently DROPPED by the restore loops'
// `if (registry.has(id))` guards instead of being rejected up front. Per
// the project's established registry-drift principle (QA-2026-09-01-013):
// silently filtering an owned current entry is data loss, not recovery —
// registry drift must hard-fail before any owner mutation, the same
// contract equipment already had.
import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { CURRENT_SAVE_VERSION } from '../../services/save/saveVersion'
import type { Material } from '../material/Material'
import type { Pill } from '../pill/Pill'
import type { Building } from '../building/Building'
import type { GameSave } from '../../services/save/SaveSystem'

const MATERIAL: Material = {
  id: 'r10_preflight_material',
  name: 'Preflight Test Material',
  category: 'other',
  sourceType: 'monster',
  stackLimit: 999,
}

const PILL: Pill = {
  id: 'r10_preflight_pill',
  name: 'Preflight Test Pill',
  type: 'healing',
  grade: 'hoang',
  effects: [],
}

const BUILDING: Building = {
  id: 'r10_preflight_building',
  name: 'Preflight Test Building',
  category: 'crafting_station',
  tier: 1,
  maxLevel: 1,
  baseStorageCapacity: 0,
  upgradeCost: [[]],
}

function makeManager(): GameManager {
  const manager = new GameManager()
  manager.registerMaterials([MATERIAL])
  manager.registerPills([PILL])
  manager.registerBuildings([BUILDING])
  return manager
}

function baseSave(overrides: Partial<GameSave> = {}): GameSave {
  const player = createDefaultPlayer()

  return {
    version: CURRENT_SAVE_VERSION,
    player,
    techniques: [],
    skills: [],
    materials: [],
    equipment: [],
    equipmentSlots: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    quests: { active: [], completedOnceIds: [], lastDailyResetAtMs: 0 },
    productionSites: [],
    ...overrides,
  }
}

describe('GameManagerSaveRestore — preflight registry drift coverage (R10, S4)', () => {
  it('rejects an unknown material reference before any owner mutation', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()
    manager.setActivePlayer(player)

    // Pre-existing, valid material the restore must NOT touch on rejection.
    manager.materialBag.add(manager.materialRegistry.get('r10_preflight_material'), 5)

    const save = baseSave({ materials: [{ materialId: 'removed_material_id', amount: 10 }] })

    expect(() => manager.restoreFromSave(save)).toThrow('Unknown material in save: removed_material_id')
    // Preflight rejection must leave the live bag untouched.
    expect(manager.materialBag.getAmount('r10_preflight_material')).toBe(5)
  })

  it('rejects an unknown pill reference before any owner mutation', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()
    manager.setActivePlayer(player)

    const save = baseSave({ pills: [{ pillId: 'removed_pill_id', amount: 1 }] })

    expect(() => manager.restoreFromSave(save)).toThrow('Unknown pill in save: removed_pill_id')
  })

  it('rejects an unknown building reference before any owner mutation', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()
    manager.setActivePlayer(player)

    const save = baseSave({
      buildings: [{ instanceId: 'inst-1', buildingId: 'removed_building_id', level: 1, lastCollectedAt: 0 }],
    })

    expect(() => manager.restoreFromSave(save)).toThrow('Unknown building in save: removed_building_id')
  })
})
