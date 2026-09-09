// R10 (AR-12, S3) — restore replaces bag contents instead of adding.
// Pre-R10, GameManagerSaveRestore.restoreFromSave() looped save.materials/
// save.pills through MaterialBag.add()/PillBag.add() without clearing the
// live bag first — a live-session restore (boot retry, reload race) into a
// nonempty bag would MERGE saved amounts on top of whatever was already
// there instead of replacing it. Fresh boot starts empty so this was
// invisible in the only production caller today; it is still a correctness
// contract for future in-session restores (see plan self-review notes).
import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import type { PlayerData } from '../player/Player'
import { CURRENT_SAVE_VERSION } from '../../services/save/saveVersion'
import type { Material } from '../material/Material'
import type { Pill } from '../pill/Pill'
import type { GameSave } from '../../services/save/SaveSystem'

const MATERIAL_A: Material = {
  id: 'r10_replace_material_a',
  name: 'Replace Test Material A',
  category: 'other',
  sourceType: 'monster',
  stackLimit: 999,
}

const MATERIAL_B: Material = {
  id: 'r10_replace_material_b',
  name: 'Replace Test Material B',
  category: 'other',
  sourceType: 'monster',
  stackLimit: 999,
}

const PILL_A: Pill = {
  id: 'r10_replace_pill_a',
  name: 'Replace Test Pill A',
  type: 'healing',
  grade: 'hoang',
  effects: [],
}

function makeManager(): GameManager {
  const manager = new GameManager()
  manager.registerMaterials([MATERIAL_A, MATERIAL_B])
  manager.registerPills([PILL_A])
  return manager
}

function baseSave(player: PlayerData, overrides: Partial<GameSave> = {}): GameSave {
  return {
    version: CURRENT_SAVE_VERSION,
    player: { ...player },
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

describe('GameManagerSaveRestore — replacement semantics (R10, S3)', () => {
  it('restoring into a nonempty material bag REPLACES contents (not additive)', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()
    manager.setActivePlayer(player)

    // Pre-seed the live bag with a stack the save does NOT mention.
    manager.materialBag.add(manager.materialRegistry.get('r10_replace_material_b'), 30)

    manager.restoreFromSave(baseSave(player, { materials: [{ materialId: 'r10_replace_material_a', amount: 5 }] }))

    expect(manager.materialBag.getAmount('r10_replace_material_a')).toBe(5)
    // Pre-existing, unrelated stack must be gone — replaced, not merged.
    expect(manager.materialBag.getAmount('r10_replace_material_b')).toBe(0)
    expect(manager.materialBag.getAll()).toHaveLength(1)
  })

  it('restoring into a nonempty pill bag REPLACES contents (not additive)', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()
    manager.setActivePlayer(player)

    manager.pillBag.add(manager.pillRegistry.get('r10_replace_pill_a'), 7)

    manager.restoreFromSave(baseSave(player, { pills: [] }))

    expect(manager.pillBag.getAmount('r10_replace_pill_a')).toBe(0)
    expect(manager.pillBag.getAll()).toHaveLength(0)
  })

  it('same save restored twice -> material/pill bag state identical (repeat-application)', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()
    manager.setActivePlayer(player)

    const save = baseSave(player, {
      materials: [{ materialId: 'r10_replace_material_a', amount: 12 }],
      pills: [{ pillId: 'r10_replace_pill_a', amount: 3 }],
    })

    manager.restoreFromSave(save)
    manager.restoreFromSave(save)

    expect(manager.materialBag.getAmount('r10_replace_material_a')).toBe(12)
    expect(manager.pillBag.getAmount('r10_replace_pill_a')).toBe(3)
  })
})
