// Beta-final B1.4 - the ONE starter-grant transaction. Asserts the same
// code path reconstructs a starter snapshot from canonical server
// metadata (CHARACTER_UNINITIALIZED) and from the creation payload, with
// deterministic picks: exactly one snapshot, never a reroll.
import { describe, expect, it, vi } from 'vitest'
import {
  initializeCharacter,
  initializationMetadataFromRemote,
  type CharacterInitializationMetadata,
  type InitializeCharacterOwners,
} from './initializeCharacter'
import type { RemoteCharacterMetadata } from '../session/BackendStatus'
import { createDefaultPlayer } from '../../core/player/Player'
import type { GameManager } from '../../core/game/GameManager'
import { MORTAL_PRECURSOR_SKILL_IDS } from '../../core/skill/MortalPrecursors'

const METADATA: CharacterInitializationMetadata = {
  name: 'Vo Danh',
  talentIds: ['talent-a'],
}

const REMOTE_CHARACTER: RemoteCharacterMetadata = {
  id: 'char-1',
  name: 'Vo Danh',
  selectedTalentIds: ['talent-a'],
  baseAttributes: { strength: 1, dexterity: 1, intelligence: 1, attunement: 1, vitality: 1 },
  mortalBasicSkillId: 'linh_bao',
  realmId: 'mortal',
  realmLevel: 0,
  createdAt: '2026-09-30T00:00:00Z',
}

function makeOwners() {
  const learned: string[] = []
  const player = createDefaultPlayer()
  const calls = {
    learnSkill: vi.fn((skillId: string) => {
      learned.push(skillId)
      return true
    }),
    setMortalBasicSkill: vi.fn((_player: unknown, skillId: string) => {
      player.mortalBasicSkillId = skillId
      return true
    }),
    buildingAdd: vi.fn(),
    refreshAutoWorkerCapacity: vi.fn(),
    reconcileBuildings: vi.fn(),
    materialAdd: vi.fn(),
    setProductionAutoRestart: vi.fn(),
    setActivePlayer: vi.fn(),
    reconcileQuestLifecycle: vi.fn(),
  }

  const gameManager = {
    progressionOps: {
      learnSkill: calls.learnSkill,
      setMortalBasicSkill: calls.setMortalBasicSkill,
    },
    skillManager: { has: (skillId: string) => learned.includes(skillId) },
    buildingManager: { add: calls.buildingAdd },
    buildingOps: {
      refreshAutoWorkerCapacity: calls.refreshAutoWorkerCapacity,
      setProductionAutoRestart: calls.setProductionAutoRestart,
      reconcileBuildings: calls.reconcileBuildings,
    },
    materialRegistry: {
      has: () => true,
      get: (id: string) => ({ id }),
    },
    materialBag: { add: calls.materialAdd },
    productionSystem: {
      getSiteDefinitions: () => [{ siteId: 'linh_tuyen' }, { siteId: 'khi_duong' }],
    },
    setActivePlayer: calls.setActivePlayer,
    tickOps: { reconcileQuestLifecycle: calls.reconcileQuestLifecycle },
  } as unknown as GameManager

  const owners: InitializeCharacterOwners = {
    gameManager,
    player,
    nowSeconds: () => 4242,
  }

  return { owners, player, calls }
}

describe('initializeCharacter - one starter snapshot from canonical metadata', () => {
  it('maps remote metadata onto the initialization input (no reroll)', () => {
    const mapped = initializationMetadataFromRemote(REMOTE_CHARACTER)

    expect(mapped).toEqual({
      name: 'Vo Danh',
      talentIds: ['talent-a'],
    })
  })

  it('rejects a remote row whose starter pick is not the beta constant', () => {
    // BETA SCOPE LOCK v2: a row carrying any other starter pick is
    // corrupt server data - the adapter fails closed at the metadata
    // seam, before any boot grant runs.
    for (const pick of ['tram', 'huy_quyen', 'hoa_cau_thuat', '']) {
      expect(() =>
        initializationMetadataFromRemote({ ...REMOTE_CHARACTER, mortalBasicSkillId: pick }),
      ).toThrow(/not the beta starter/)
    }
  })

  it('writes the creation profile + deterministic picks through the real grant owners', () => {
    const { owners, player, calls } = makeOwners()

    initializeCharacter(METADATA, owners)

    expect(player.name).toBe('Vo Danh')
    expect(player.selectedTalentIds).toEqual(['talent-a'])
    expect(player.mortalBasicSkillId).toBe('linh_bao')

    // All three precursors learned (v82 hidden-way gates stay reachable).
    expect(calls.learnSkill).toHaveBeenCalledTimes(MORTAL_PRECURSOR_SKILL_IDS.length)
    for (const skillId of MORTAL_PRECURSOR_SKILL_IDS) {
      expect(calls.learnSkill).toHaveBeenCalledWith(skillId, player)
    }
    expect(calls.setMortalBasicSkill).toHaveBeenCalledWith(player, 'linh_bao')
  })

  it('grants all registered buildings at lv1 + starter materials + auto-restart + active player', () => {
    const { owners, player, calls } = makeOwners()

    initializeCharacter(METADATA, owners)

    // Default-built (2026-10-03): the building grant goes through the
    // ops reconcile - every registered building starts at level 1.
    expect(calls.reconcileBuildings).toHaveBeenCalledTimes(1)
    expect(calls.reconcileBuildings).toHaveBeenCalledWith(player, 4242)

    expect(calls.materialAdd).toHaveBeenCalledTimes(2)
    const materials = calls.materialAdd.mock.calls.map(([material, amount]) => [
      (material as { id: string }).id,
      amount,
    ])
    expect(materials).toEqual([
      ['mortal_wood_decade', 15],
      ['mortal_ore_decade', 6],
    ])

    expect(calls.setProductionAutoRestart).toHaveBeenCalledTimes(2)
    expect(calls.setProductionAutoRestart).toHaveBeenCalledWith('linh_tuyen', true)
    expect(calls.setProductionAutoRestart).toHaveBeenCalledWith('khi_duong', true)

    expect(calls.setActivePlayer).toHaveBeenCalledWith(player)

    // Mainline chain admission (AR-09): the quest lifecycle reconcile
    // closes the creation snapshot - a fresh board shows main_01
    // without waiting for a realm transition or a save restore.
    expect(calls.reconcileQuestLifecycle).toHaveBeenCalledTimes(1)
    expect(calls.reconcileQuestLifecycle.mock.invocationCallOrder[0]).toBeGreaterThan(
      calls.setActivePlayer.mock.invocationCallOrder[0]!,
    )
  })

  it('a rejected starter write propagates (a boot that cannot pin linh_bao never defaults silently)', () => {
    const { owners, calls } = makeOwners()
    calls.setMortalBasicSkill.mockReturnValue(false)

    expect(() => initializeCharacter(METADATA, owners)).toThrow()
  })

  it('reconstructing from the same metadata produces the identical snapshot shape', () => {
    // The deep-equality below compares mock-call snapshots that embed the
    // whole player object; lastSavedAt is wall-clock stamped per
    // construction, so pin the clock or two runs 1ms apart diverge.
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-09-30T00:00:00Z'))
      const first = makeOwners()
      const second = makeOwners()

      initializeCharacter(initializationMetadataFromRemote(REMOTE_CHARACTER), first.owners)
      initializeCharacter(initializationMetadataFromRemote(REMOTE_CHARACTER), second.owners)

      // Same picks, same grants - instanceIds are per-snapshot ids, not
      // rolls (the determinism contract is about picks, not uuid bytes).
      expect(second.player.name).toBe(first.player.name)
      expect(second.player.selectedTalentIds).toEqual(first.player.selectedTalentIds)
      expect(second.player.mortalBasicSkillId).toBe(first.player.mortalBasicSkillId)
      expect(second.calls.learnSkill.mock.calls).toEqual(first.calls.learnSkill.mock.calls)
      expect(second.calls.reconcileBuildings.mock.calls.length).toBe(first.calls.reconcileBuildings.mock.calls.length)
    } finally {
      vi.useRealTimers()
    }
  })
})
