// Task 3 (perf-optimize-pass) - round-trip that qua localStorage:
// buildGameSave() -> writeGameSave() -> loadGame() phai tra ve CHINH XAC
// du lieu da ghi (deep equal), chung minh viec toi uu double-serialize
// (neu co) khong doi shape luu ra. Test thu hai khoa lai ly do
// structuredClone(quests) ton tai trong buildGameSave(): questManager.getState()
// tra ve tham chieu song - mutate SAU buildGameSave() khong duoc phep ro
// vao save da build.
import { primeMortalCreationPick } from './GameSave.fixture'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// BETA SCOPE LOCK v2 Phase-5 - this suite exercises the scope-hidden
// system's ENABLED implementation (sec.11-15: dormant, not deleted),
// so the scope authority reports in-scope for this file.
vi.mock('../../core/betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../core/betaScope')>()),
  isBetaFeature: () => true,
  isScopeHidden: () => false,
}))

import { GameManager } from '../../core/game/GameManager'
import { createDefaultPlayer } from '../../core/player/Player'
import { materials } from '../../data/materials/materials'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import type { Quest } from '../../core/quest/Quest'
import { buildGameSave, loadGame, writeGameSave } from './SaveSystem'

// vitest.config chay environment: 'node' - localStorage in-memory toi
// thieu, cung convention SaveSystem.test.ts.
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

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage())
})

function createBootedGameManager(): GameManager {
  const gameManager = new GameManager()

  gameManager.catalogOps.registerMaterials(materials)
  gameManager.catalogOps.registerEquipment(equipment)
  gameManager.catalogOps.registerAffixes(affixes)
  gameManager.catalogOps.registerBuildings(buildings)

  return gameManager
}

const TEST_QUEST: Quest = {
  id: 'round_trip_test_quest',
  name: 'Round Trip Quest',
  description: 'test fixture',
  condition: { kind: 'kill', amount: 3 },
  reward: {},
  cadence: 'daily',
}

describe('SaveSystem — build/write/load round-trip (Task 3, double-serialize audit)', () => {
  it('save với quest state sống sót nguyên vẹn qua write + loadGame()', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_725_160_000_000)

    const gameManager = createBootedGameManager()
    const player = createDefaultPlayer()

    gameManager.materialBag.add(gameManager.materialRegistry.get(materials[0]!.id), 7)
    gameManager.questManager.ensureActive(TEST_QUEST)
    gameManager.questManager.incrementProgress(TEST_QUEST.id, 2)
    gameManager.questManager.markCompletedOnce('some_other_once_quest')

    primeMortalCreationPick(player, gameManager.skillManager)

    const save = buildGameSave(player, gameManager)

    const writeResult = writeGameSave(save)
    expect(writeResult).toEqual({ status: 'ok' })

    const outcome = loadGame()

    expect(outcome.status).toBe('ok')
    if (outcome.status !== 'ok') {
      return
    }

    // So sanh sau voi du lieu da build TRUOC khi ghi - bao dam
    // write/load khong doi shape, ke ca field quests (structuredClone).
    expect(outcome.save).toEqual(save)
    expect(outcome.save.quests).toEqual({
      active: [{ questId: TEST_QUEST.id, progress: 2, claimed: false }],
      completedOnceIds: ['some_other_once_quest'],
      lastDailyResetAtMs: 0,
      questFlags: [],
    })
  })

  it('mutate questManager SAU buildGameSave() không rò vào save đã build (lý do structuredClone tồn tại)', () => {
    const gameManager = createBootedGameManager()
    const player = createDefaultPlayer()

    gameManager.questManager.ensureActive(TEST_QUEST)

    primeMortalCreationPick(player, gameManager.skillManager)

    const save = buildGameSave(player, gameManager)
    const questsSnapshotBeforeMutation = structuredClone(save.quests)

    // Mo phong dung kich ban comment mo ta: mot write khac (vd
    // CloudSaveCoordinator retry sau conflict, cach await) mutate
    // questManager SAU khi save da build nhung TRUOC khi ghi that.
    gameManager.questManager.incrementProgress(TEST_QUEST.id, 999)
    gameManager.questManager.markCompletedOnce('mutated_after_build')

    // Neu buildGameSave() khong structuredClone quests, save.quests se
    // la CHINH tham chieu live va da bi mutate o tren - assert no KHONG
    // doi, tuc la save da build van la snapshot dung thoi diem.
    expect(save.quests).toEqual(questsSnapshotBeforeMutation)

    const writeResult = writeGameSave(save)
    expect(writeResult).toEqual({ status: 'ok' })

    const outcome = loadGame()

    expect(outcome.status).toBe('ok')
    if (outcome.status === 'ok') {
      expect(outcome.save.quests).toEqual(questsSnapshotBeforeMutation)
    }
  })

  it('legacy Decompose worker/timer data stays inert across save/load', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_725_160_000_000)

    const gameManager = createBootedGameManager()
    const player = createDefaultPlayer()
    gameManager.decomposeSystem.restore({
      settings: { gradeFilter: 'tien_pham', ageFilter: 'myriad_year', workers: 3 },
      nextCycleAt: Date.now() + 30_000,
      started: true,
    })

    primeMortalCreationPick(player, gameManager.skillManager)

    const save = buildGameSave(player, gameManager)
    const decomposeSnapshot = structuredClone(save.decompose)

    expect(decomposeSnapshot).toEqual({
      settings: { gradeFilter: 'all', ageFilter: 'all', workers: 0 },
      nextCycleAt: 0,
      started: false,
    })

    const writeResult = writeGameSave(save)
    expect(writeResult).toEqual({ status: 'ok' })

    const outcome = loadGame()
    expect(outcome.status).toBe('ok')
    if (outcome.status !== 'ok') {
      return
    }
    expect(outcome.save.decompose).toEqual(decomposeSnapshot)

    // Restore into a FRESH manager: historical automation does not resume.
    const fresh = createBootedGameManager()
    const freshPlayer = createDefaultPlayer()
    fresh.setActivePlayer(freshPlayer)
    const restoredModifiers = fresh.saveOps.restoreFromSave(outcome.save as ReturnType<typeof buildGameSave>)
    expect(Array.isArray(restoredModifiers)).toBe(true)
    expect(fresh.decomposeSystem.getSaveState()).toEqual(decomposeSnapshot)
  })

  it('production cycles round-trip under a neutral save field and restore idempotently', () => {
    const nowMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockReturnValue(nowMs)

    const gameManager = createBootedGameManager()
    const player = createDefaultPlayer()
    gameManager.setActivePlayer(player)

    const siteId = gameManager.productionSystem.getSiteDefinitions()[0]!.siteId
    gameManager.productionSystem.restoreStates([{
      siteId,
      level: 1,
      autoRestart: false,
      productionCycles: [{
        cycleId: 'round-trip-cycle',
        siteId,
        collectionRealmId: 'mortal',
        siteLevelAtStart: 1,
        rewardTableVersion: 1,
        rollSeed: 0x12345678,
        startedAtMs: nowMs,
        completesAtMs: nowMs + 100_000,
      }],
    }], nowMs)

    primeMortalCreationPick(player, gameManager.skillManager)
    const save = buildGameSave(player, gameManager)
    const savedSite = save.productionSites?.find((state) => state.siteId === siteId)

    expect(savedSite?.productionCycles?.[0]?.rollSeed).toBe(0x12345678)
    expect(savedSite).not.toHaveProperty('workerCycles')
    expect(savedSite).not.toHaveProperty('assignedWorkers')
    expect(save.player).not.toHaveProperty('autoWorkerCapacity')
    expect(writeGameSave(save)).toEqual({ status: 'ok' })

    const outcome = loadGame()
    expect(outcome.status).toBe('ok')
    if (outcome.status !== 'ok') return

    const fresh = createBootedGameManager()
    const freshPlayer = createDefaultPlayer()
    fresh.setActivePlayer(freshPlayer)
    const typedSave = outcome.save as ReturnType<typeof buildGameSave>
    fresh.saveOps.restoreFromSave(typedSave)
    const firstRestore = fresh.productionSystem.getState(siteId)?.productionCycles
    fresh.saveOps.restoreFromSave(typedSave)

    expect(firstRestore?.map((cycle) => cycle.rollSeed)).toEqual([0x12345678])
    expect(fresh.productionSystem.getState(siteId)?.productionCycles?.map((cycle) => cycle.rollSeed))
      .toEqual([0x12345678])
  })
})
