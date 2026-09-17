// R10 (AR-12) - whole-payload restore identity: two saves equal in the
// old 2-field fingerprint (lastSavedAt|cultivation) but different in
// name/insight must restore the CORRECT payload each (the old guard
// restored the first one and skipped the second).
import { describe, expect, it } from 'vitest'
import { createDefaultPlayer } from '../../core/player/Player'
import { materials } from '../../data/materials/materials'
import { makeInstance } from '../../core/equipment/EquipmentInstance.fixture'
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

  it('a pills-only change produces a different identity (ARCH-001)', () => {
    const player = createDefaultPlayer()
    const saveA = baseSave(player)
    const saveB = baseSave(player)

    saveB.pills = [{ pillId: 'pill_regen_mortal', amount: 1 }]

    expect(computeRestoreIdentity(saveA)).not.toBe(computeRestoreIdentity(saveB))
  })

  // M1 (ARCH-001) — every meaningful GameSave slice must contribute to
  // the restore identity: a payload that differs ONLY in one slice is a
  // different payload and must not be skipped by the idempotency guard.
  it.each([
    ['techniques', (save: GameSave) => {
      save.techniques = [{ id: 't1', name: 'T', description: '', unlocked: true, equipped: false }]
    }],
    ['skills', (save: GameSave) => {
      save.skills = [{
        id: 's1', name: 'S', description: '', type: 'active', level: 1, maxLevel: 10,
        cooldown: 1, target: 'enemy', effects: [], unlocked: true, equipped: false,
      }]
    }],
    ['equipment', (save: GameSave) => {
      save.equipment = [makeInstance({ instanceId: 'identity-item' })]
    }],
    ['talismans', (save: GameSave) => {
      save.talismans = [{ talismanId: 'legacy-talisman', amount: 1 }]
    }],
    ['formations', (save: GameSave) => {
      save.formations = [{ formationId: 'legacy-formation', amount: 1 }]
    }],
    ['buildings', (save: GameSave) => {
      save.buildings = [{ instanceId: 'b1', buildingId: 'b', level: 1, lastCollectedAt: 0 }]
    }],
    ['equipmentSlots', (save: GameSave) => {
      save.equipmentSlots = [{
        slot: 'weapon', enhanceLevel: 1, enhanceFailStreak: 0,
      }]
    }],
    ['productionSites', (save: GameSave) => {
      save.productionSites = [{ siteId: 'site-1', level: 2, autoRestart: true }]
    }],
    ['alchemyJobs', (save: GameSave) => {
      save.alchemyJobs = [{
        jobId: 'j1', recipeId: 'r1', pillId: 'p1', herbMaterialId: 'h1',
        startedAtMs: 0, completesAtMs: 1, roomLevelAtStart: 1,
      }]
    }],
    ['quests', (save: GameSave) => {
      save.quests = { active: [{ questId: 'q1', progress: 1, claimed: false }], completedOnceIds: [], lastDailyResetAtMs: 0 }
    }],
    ['decompose', (save: GameSave) => {
      save.decompose = {
        settings: { gradeFilter: 'all', ageFilter: 'all', workers: 2 },
        nextCycleAt: 1000,
        started: true,
      }
    }],
  ] as const)('a change confined to save.%s changes the restore identity', (_slice, mutate) => {
    const player = createDefaultPlayer()
    const saveA = baseSave(player)
    const saveB = baseSave(player)

    mutate(saveB)

    expect(computeRestoreIdentity(saveA)).not.toBe(computeRestoreIdentity(saveB))
  })

  it('an absent optional slice differs from a present-but-empty one (presence is a payload difference)', () => {
    const player = createDefaultPlayer()
    const saveA = baseSave(player)
    const saveB = baseSave(player)

    delete saveB.quests

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

  it('store-level: restoring must not alias nested fields back into the caller\'s save object', async () => {
    // A plain Object.assign(this, save.player) shallow-copies nested
    // objects by reference (e.g. store.baseStats becomes the SAME object
    // as save.player.baseStats). A later in-place store mutation
    // (attackRange normalization) would then corrupt the caller's `save`
    // object, changing what a second restoreFromSave(save) call with the
    // SAME reference computes as its identity — silently defeating the
    // payload-identity guard itself. Restore input must be a value.
    const { usePlayerStore } = await import('../../stores/player')
    const { createPinia, setActivePinia } = await import('pinia')
    setActivePinia(createPinia())

    const player = createDefaultPlayer()
    const save = baseSave(player)
    const baseStatsSnapshot = structuredClone(save.player.baseStats)

    const store = usePlayerStore()
    const first = store.restoreFromSave(save)

    // The restore's own normalization step mutates store.baseStats.attackRange
    // — this must not be visible through save.player.baseStats afterward.
    expect(save.player.baseStats).toEqual(baseStatsSnapshot)

    const second = store.restoreFromSave(save)

    // Same object reference, unmutated by the first restore -> identity
    // gate must converge (no double-credited offline progress).
    expect(second).toEqual(first)
  })
})
