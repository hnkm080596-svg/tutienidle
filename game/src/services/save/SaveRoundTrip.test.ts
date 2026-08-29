// save-shape-validation-plan.md Task 3 — lưới an toàn round-trip:
// buildGameSave() thật → JSON.stringify → JSON.parse → validateGameSaveShape()
// phải luôn ok. Bất kỳ field bắt buộc mới nào thiếu trong save (hoặc
// validator quá chặt với field thật) đều làm test này đỏ.
import { describe, expect, it } from 'vitest'
import { buildGameSave } from './SaveSystem'
import { validateGameSaveShape } from './saveShapeValidation'
import { GameManager } from '../../core/game/GameManager'
import { createDefaultPlayer } from '../../core/player/Player'
import type { Material } from '../../core/material/Material'

const TEST_MATERIAL: Material = {
  id: 'round_trip_test_material',
  name: 'Round Trip Material',
  category: 'other',
  sourceType: 'monster',
}

function createBootedGameManager(): GameManager {
  const gameManager = new GameManager()

  gameManager.registerMaterials([TEST_MATERIAL])

  return gameManager
}

describe('SaveRoundTrip — buildGameSave() luôn qua validateGameSaveShape()', () => {
  it('save mới khởi tạo (chưa có gì) vẫn nguyên shape', () => {
    const gameManager = createBootedGameManager()
    const player = createDefaultPlayer()

    const save = buildGameSave(player, gameManager)
    const roundTripped: unknown = JSON.parse(JSON.stringify(save))

    expect(validateGameSaveShape(roundTripped)).toEqual({ ok: true, issues: [] })
  })

  it('save sau thao tác đại diện (material vào túi) vẫn nguyên shape', () => {
    const gameManager = createBootedGameManager()

    gameManager.materialBag.add(TEST_MATERIAL, 42)

    const player = createDefaultPlayer()

    const save = buildGameSave(player, gameManager)
    const roundTripped: unknown = JSON.parse(JSON.stringify(save))

    const result = validateGameSaveShape(roundTripped)

    expect(result).toEqual({ ok: true, issues: [] })

    // Material thật sự đi qua serialize đúng shape.
    const materials = (roundTripped as { materials: Array<{ materialId: string; amount: number }> })
      .materials

    expect(materials).toContainEqual({ materialId: TEST_MATERIAL.id, amount: 42 })
  })

  // Spec dot-pha-loi-kiep §6.1 — 4 fields mới v54: openedMeridianIds,
  // luyenKhiKillsSinceBeast, mortalPerfectionAchieved,
  // greatDaoOpportunityLost phải sống sót qua round-trip JSON.
  it('save v54 với 4 fields đột phá mới round-trip nguyên vẹn', () => {
    const gameManager = createBootedGameManager()
    const player = createDefaultPlayer()

    player.openedMeridianIds = ['nham_mach', 'doi_mach']
    player.luyenKhiKillsSinceBeast = 500
    player.mortalPerfectionAchieved = true
    player.greatDaoOpportunityLost = false

    const save = buildGameSave(player, gameManager)
    const roundTripped: unknown = JSON.parse(JSON.stringify(save))

    expect(validateGameSaveShape(roundTripped)).toEqual({ ok: true, issues: [] })

    const playerData = (roundTripped as { player: typeof player }).player

    expect(playerData.openedMeridianIds).toEqual(['nham_mach', 'doi_mach'])
    expect(playerData.luyenKhiKillsSinceBeast).toBe(500)
    expect(playerData.mortalPerfectionAchieved).toBe(true)
    expect(playerData.greatDaoOpportunityLost).toBe(false)
  })
})
