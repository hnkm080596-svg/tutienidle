// R10 (AR-12) - whole-payload restore identity: two saves equal in the
// old 2-field fingerprint (lastSavedAt|cultivation) but different in
// name/insight must restore the CORRECT payload each (the old guard
// restored the first one and skipped the second).
import { describe, expect, it } from 'vitest'
import { createDefaultPlayer } from '../../core/player/Player'
import { materials } from '../../data/materials/materials'
import { computeRestoreIdentity, type GameSave } from '../../services/save/SaveSystem'
import { CURRENT_SAVE_VERSION } from '../../services/save/saveVersion'

function baseSave(player: ReturnType<typeof createDefaultPlayer>): GameSave {
  return {
    version: CURRENT_SAVE_VERSION,
    player: { ...player, lastSavedAt: 1_725_160_000_000, cultivation: 500 },
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
  }
}

describe('restore identity (AR-12)', () => {
  it('hash excludes lastSavedAt - identical content with a new timestamp keeps the same identity', () => {
    const player = createDefaultPlayer()
    const saveA = baseSave(player)
    const saveB = baseSave(player)
    saveB.player.lastSavedAt = 9_999_999_999

    expect(computeRestoreIdentity(saveA)).toBe(computeRestoreIdentity(saveB))
  })

  it('any payload change (even same lastSavedAt|cultivation) changes the identity', () => {
    const playerA = createDefaultPlayer()
    const saveA = baseSave(playerA)

    const playerB = createDefaultPlayer()
    playerB.name = 'different-name'
    playerB.skillCastCounts = { tram: 7 }
    const saveB = baseSave(playerB)

    // The audit counterexample: old 2-field fingerprint saw these as equal.
    expect(saveA.player.lastSavedAt).toBe(saveB.player.lastSavedAt)
    expect(saveA.player.cultivation).toBe(saveB.player.cultivation)
    expect(computeRestoreIdentity(saveA)).not.toBe(computeRestoreIdentity(saveB))
  })

  it('materials change the identity even with identical player state', () => {
    const player = createDefaultPlayer()
    const saveA = baseSave(player)
    const saveB = baseSave(player)

    const ore = materials.find((m) => m.id === 'qi_refining_ore_century')!
    saveB.materials = [{ materialId: ore.id, amount: 5 }]

    expect(computeRestoreIdentity(saveA)).not.toBe(computeRestoreIdentity(saveB))
  })

  it('store-level guard: second payload with the SAME fingerprint but different content is applied, not skipped', async () => {
    // Direct store-level check through the Pinia store action.
    const { usePlayerStore } = await import('../../stores/player')
    const { createPinia, setActivePinia } = await import('pinia')
    setActivePinia(createPinia())

    const playerA = createDefaultPlayer()
    const saveA = baseSave(playerA)

    const playerB = createDefaultPlayer()
    playerB.name = 'second-payload-name'
    const saveB = baseSave(playerB)

    const store = usePlayerStore()
    store.restoreFromSave(saveA)
    expect(store.name).toBe(saveA.player.name)

    // Same lastSavedAt|cultivation, different content -> MUST apply now
    // (the old 2-field guard would have skipped this restore).
    store.restoreFromSave(saveB)
    expect(store.name).toBe(saveB.player.name)
  })
})
