// M-F-BODY-PERFECTION (spec S7, plan Step 5.6, C2C r68) - the
// bodyPerfection slice through the REAL save boundary: fixture-registry
// non-empty round-trip (serialize -> shape-validate -> restore),
// production all-empty round-trip, malformed-payload emits, the
// immediately-previous version rejected (C2C r60-f5), and the
// future-realm-perfected integrity cap (C2C r60-f2).
import { primeMortalCreationPick } from './GameSave.fixture'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { FIXTURE } = vi.hoisted(() => {
  const FIXTURE: Record<string, readonly string[]> = {
  mortal: ['tinh_hoa_pham_the'],
  qi_refining: ['great_dao_seed', 'yeu_dan_hung_giao'],
  foundation_establishment: [],
  golden_core: [],
  nascent_soul: [],
  soul_transformation: [],
  void_refinement: [],
  body_integration: [],
  mahayana: [],
  tribulation: [],
}
  return { FIXTURE }
})

vi.mock('../../data/realm/BodyPerfection', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/realm/BodyPerfection')>()

  const byRealm = new Map(Object.entries(FIXTURE).map(([realm, ids]) => [realm, ids]))
  const realmOf = new Map<string, string>()
  for (const [realm, ids] of byRealm) {
    for (const id of ids) {
      realmOf.set(id, realm)
    }
  }

  return {
    ...actual,
    BODY_PERFECTION_REALM_MATERIALS: FIXTURE,
    bodyPerfectionMaterialIds: (realmId: string) => byRealm.get(realmId) ?? [],
    bodyPerfectionRealmOf: (materialId: string) => realmOf.get(materialId),
    isBodyPerfectionMaterial: (materialId: string) => realmOf.has(materialId),
  }
})

import { GameManager } from '../../core/game/GameManager'
import { createDefaultPlayer } from '../../core/player/Player'
import { materials } from '../../data/materials/materials'
import { usePlayerStore } from '../../stores/player'
import {
  buildGameSave,
  CURRENT_SAVE_VERSION,
  loadGame,
  restoreGameSession,
  type GameSave,
} from './SaveSystem'
import { validateGameSaveShape } from './saveShapeValidation'
import { resolveSaveKey } from './saveKeys'

// vitest node env - minimal in-memory localStorage (same pattern as
// saveVersion.test.ts).
class MemoryStorage implements Storage {
  private store = new Map<string, string>()

  get length() {
    return this.store.size
  }
  clear(): void {
    this.store.clear()
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }
}

function registeredManager(): GameManager {
  const manager = new GameManager()
  manager.catalogOps.registerMaterials(materials)
  return manager
}

describe('bodyPerfection save round-trip (C2C r68)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('localStorage', new MemoryStorage())
  })

  it('fixture-registry: a legal non-empty slice survives serialize -> validate -> restore', () => {
    const manager = registeredManager()
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    player.bodyPerfection = {
      discoveredMaterials: ['tinh_hoa_pham_the', 'great_dao_seed'],
      perfectedRealmIds: ['mortal'],
    }
    manager.setActivePlayer(player)

    primeMortalCreationPick(player, manager.skillManager)

    const save = buildGameSave(player, manager)
    const persisted = JSON.parse(JSON.stringify(save)) as unknown

    const shape = validateGameSaveShape(persisted)
    expect(shape.ok).toBe(true)
    if (!shape.ok) {
      return
    }

    const freshPlayer = usePlayerStore()
    const freshManager = registeredManager()
    const restored = restoreGameSession(freshPlayer, freshManager, shape.normalizedSave as GameSave)

    expect(restored.status).toBe('ok')
    expect(freshPlayer.$state.bodyPerfection).toEqual({
      discoveredMaterials: ['tinh_hoa_pham_the', 'great_dao_seed'],
      perfectedRealmIds: ['mortal'],
    })
    // Both sets survive END-TO-END, not just field presence.
    expect(freshPlayer.$state.bodyPerfection.discoveredMaterials).toContain('great_dao_seed')
    expect(freshPlayer.$state.bodyPerfection.perfectedRealmIds).toContain('mortal')
  })

  it('production all-empty round-trip keeps both sets [] (v80 fields present)', () => {
    const manager = registeredManager()
    const player = createDefaultPlayer()
    manager.setActivePlayer(player)

    primeMortalCreationPick(player, manager.skillManager)

    const save = buildGameSave(player, manager)
    expect(save.version).toBe(CURRENT_SAVE_VERSION)
    expect(save.player.bodyPerfection).toEqual({
      discoveredMaterials: [],
      perfectedRealmIds: [],
    })

    const persisted = JSON.parse(JSON.stringify(save)) as unknown
    const shape = validateGameSaveShape(persisted)
    expect(shape.ok).toBe(true)
    if (!shape.ok) {
      return
    }

    const freshPlayer = usePlayerStore()
    const freshManager = registeredManager()
    const restored = restoreGameSession(freshPlayer, freshManager, shape.normalizedSave as GameSave)

    expect(restored.status).toBe('ok')
    expect(freshPlayer.$state.bodyPerfection).toEqual({
      discoveredMaterials: [],
      perfectedRealmIds: [],
    })
  })

  it('malformed bodyPerfection payloads emit shape issues', () => {
    const manager = registeredManager()
    const player = createDefaultPlayer()
    manager.setActivePlayer(player)
    primeMortalCreationPick(player, manager.skillManager)
    const save = buildGameSave(player, manager)
    const persisted = JSON.parse(JSON.stringify(save)) as Record<string, unknown>

    const playerRecord = persisted.player as Record<string, unknown>
    delete playerRecord.bodyPerfection

    const shape = validateGameSaveShape(persisted)
    expect(shape.ok).toBe(false)
    if (!shape.ok) {
      expect(
        shape.issues.some((issue) => issue.path === 'player.bodyPerfection'),
      ).toBe(true)
    }

    // Non-array field variant.
    playerRecord.bodyPerfection = { discoveredMaterials: 'x', perfectedRealmIds: [] }
    const shape2 = validateGameSaveShape(persisted)
    expect(shape2.ok).toBe(false)
    if (!shape2.ok) {
      expect(
        shape2.issues.some((issue) => issue.path === 'player.bodyPerfection.discoveredMaterials'),
      ).toBe(true)
    }
  })

  it('rejects the immediately-previous save version (C2C r60-f5)', () => {
    const previous = CURRENT_SAVE_VERSION - 1
    const player = createDefaultPlayer()
    const save = {
      version: previous,
      player,
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

    localStorage.setItem(resolveSaveKey(), JSON.stringify(save))

    const outcome = loadGame()
    expect(outcome.status).toBe('incompatible')
    if (outcome.status === 'incompatible') {
      expect(outcome.foundVersion).toBe(previous)
    }
  })

  it('restore preflight rejects a perfected FUTURE realm (C2C r60-f2)', () => {
    const manager = registeredManager()
    const player = createDefaultPlayer()
    player.realmId = 'mortal'
    // Crafted save: qi_refining perfected while the player is mortal.
    player.bodyPerfection = {
      discoveredMaterials: ['great_dao_seed', 'yeu_dan_hung_giao'],
      perfectedRealmIds: ['qi_refining'],
    }
    manager.setActivePlayer(player)

    primeMortalCreationPick(player, manager.skillManager)

    const save = buildGameSave(player, manager)

    const freshPlayer = usePlayerStore()
    const freshManager = registeredManager()
    const restored = restoreGameSession(freshPlayer, freshManager, save)

    expect(restored.status).toBe('rejected')
    if (restored.status === 'rejected') {
      expect(restored.message).toContain('Body-perfection integrity')
    }
    expect(freshPlayer.$state.bodyPerfection.perfectedRealmIds).toEqual([])
  })

  it('restore preflight allows future-realm DISCOVERY (legal early find)', () => {
    const manager = registeredManager()
    const player = createDefaultPlayer()
    player.realmId = 'mortal'
    player.bodyPerfection = {
      discoveredMaterials: ['great_dao_seed'],
      perfectedRealmIds: [],
    }
    manager.setActivePlayer(player)

    primeMortalCreationPick(player, manager.skillManager)

    const save = buildGameSave(player, manager)

    const freshPlayer = usePlayerStore()
    const freshManager = registeredManager()
    const restored = restoreGameSession(freshPlayer, freshManager, save)

    expect(restored.status).toBe('ok')
    expect(freshPlayer.$state.bodyPerfection.discoveredMaterials).toEqual(['great_dao_seed'])
  })

  it('restore exclusion: a bag-held perfection material with empty discovery stays undiscovered (C2C r76-f3)', () => {
    const manager = registeredManager()
    const player = createDefaultPlayer()
    player.realmId = 'mortal'
    manager.setActivePlayer(player)
    manager.materialBag.add(manager.materialRegistry.get('tinh_hoa_pham_the'), 2)

    primeMortalCreationPick(player, manager.skillManager)

    const save = buildGameSave(player, manager)
    // Inventory holds the fixture perfection material while the
    // discovery slice is empty - restore must never derive discovery
    // from bag contents, and no funnel subscriber may fire.
    expect(save.materials.some((slot) => slot.materialId === 'tinh_hoa_pham_the')).toBe(true)
    expect(save.player.bodyPerfection.discoveredMaterials).toEqual([])

    const freshPlayer = usePlayerStore()
    const freshManager = registeredManager()
    const funnelSpy = vi.spyOn(freshManager.questOps, 'notifyMaterialGained')
    const questSpy = vi.spyOn(freshManager.questSystem, 'onMaterialCollected')

    const restored = restoreGameSession(freshPlayer, freshManager, save)

    expect(restored.status).toBe('ok')
    expect(freshManager.materialBag.getAmount('tinh_hoa_pham_the')).toBe(2)
    expect(freshPlayer.$state.bodyPerfection.discoveredMaterials).toEqual([])
    expect(funnelSpy).not.toHaveBeenCalled()
    expect(questSpy).not.toHaveBeenCalled()
  })

  it('restore preflight rejects perfected state missing its discoveries', () => {
    const manager = registeredManager()
    const player = createDefaultPlayer()
    player.realmId = 'mortal'
    // Crafted: perfected mortal but the authored material is
    // undiscovered - violates the subset invariant.
    player.bodyPerfection = {
      discoveredMaterials: [],
      perfectedRealmIds: ['mortal'],
    }
    manager.setActivePlayer(player)

    primeMortalCreationPick(player, manager.skillManager)

    const save = buildGameSave(player, manager)

    const freshPlayer = usePlayerStore()
    const freshManager = registeredManager()
    const restored = restoreGameSession(freshPlayer, freshManager, save)

    expect(restored.status).toBe('rejected')
    if (restored.status === 'rejected') {
      expect(restored.message).toContain('Body-perfection integrity')
    }
  })
})
