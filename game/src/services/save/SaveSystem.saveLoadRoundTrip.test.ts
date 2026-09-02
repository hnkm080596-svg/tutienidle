// Task 3 (perf-optimize-pass) — round-trip thật qua localStorage:
// buildGameSave() -> writeGameSave() -> loadGame() phải trả về CHÍNH XÁC
// dữ liệu đã ghi (deep equal), chứng minh việc tối ưu double-serialize
// (nếu có) không đổi shape lưu ra. Test thứ hai khoá lại lý do
// structuredClone(quests) tồn tại trong buildGameSave(): questManager.getState()
// trả về tham chiếu sống — mutate SAU buildGameSave() không được phép rò
// vào save đã build.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GameManager } from '../../core/game/GameManager'
import { createDefaultPlayer } from '../../core/player/Player'
import { materials } from '../../data/materials/materials'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import type { Quest } from '../../core/quest/Quest'
import { buildGameSave, loadGame, writeGameSave } from './SaveSystem'

// vitest.config chạy environment: 'node' — localStorage in-memory tối
// thiểu, cùng convention SaveSystem.test.ts.
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

  gameManager.registerMaterials(materials)
  gameManager.registerEquipment(equipment)
  gameManager.registerAffixes(affixes)

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

    const save = buildGameSave(player, gameManager)

    const writeResult = writeGameSave(save)
    expect(writeResult).toEqual({ status: 'ok' })

    const outcome = loadGame()

    expect(outcome.status).toBe('ok')
    if (outcome.status !== 'ok') {
      return
    }

    // So sánh sâu với dữ liệu đã build TRƯỚC khi ghi — bảo đảm
    // write/load không đổi shape, kể cả field quests (structuredClone).
    expect(outcome.save).toEqual(save)
    expect(outcome.save.quests).toEqual({
      active: [{ questId: TEST_QUEST.id, progress: 2, claimed: false }],
      completedOnceIds: ['some_other_once_quest'],
      lastDailyResetAtMs: 0,
    })
  })

  it('mutate questManager SAU buildGameSave() không rò vào save đã build (lý do structuredClone tồn tại)', () => {
    const gameManager = createBootedGameManager()
    const player = createDefaultPlayer()

    gameManager.questManager.ensureActive(TEST_QUEST)

    const save = buildGameSave(player, gameManager)
    const questsSnapshotBeforeMutation = structuredClone(save.quests)

    // Mô phỏng đúng kịch bản comment mô tả: một write khác (vd
    // CloudSaveCoordinator retry sau conflict, cách await) mutate
    // questManager SAU khi save đã build nhưng TRƯỚC khi ghi thật.
    gameManager.questManager.incrementProgress(TEST_QUEST.id, 999)
    gameManager.questManager.markCompletedOnce('mutated_after_build')

    // Nếu buildGameSave() không structuredClone quests, save.quests sẽ
    // là CHÍNH tham chiếu live và đã bị mutate ở trên — assert nó KHÔNG
    // đổi, tức là save đã build vẫn là snapshot đúng thời điểm.
    expect(save.quests).toEqual(questsSnapshotBeforeMutation)

    const writeResult = writeGameSave(save)
    expect(writeResult).toEqual({ status: 'ok' })

    const outcome = loadGame()

    expect(outcome.status).toBe('ok')
    if (outcome.status === 'ok') {
      expect(outcome.save.quests).toEqual(questsSnapshotBeforeMutation)
    }
  })
})
