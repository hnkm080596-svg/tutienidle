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
import type { EquipmentInstance } from '../../core/equipment/EquipmentInstance'

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

function normalizedSaveOf(
  result: ReturnType<typeof validateGameSaveShape>,
): Record<string, unknown> {
  if (
    !result.ok ||
    !isRecord(result.normalizedSave)
  ) {
    throw new Error('Expected a normalized save object')
  }

  return result.normalizedSave
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

describe('SaveRoundTrip — buildGameSave() luôn qua validateGameSaveShape()', () => {
  it('save mới khởi tạo (chưa có gì) vẫn nguyên shape', () => {
    const gameManager = createBootedGameManager()
    const player = createDefaultPlayer()

    const save = buildGameSave(player, gameManager)
    const roundTripped: unknown = JSON.parse(JSON.stringify(save))

    expect(validateGameSaveShape(roundTripped)).toMatchObject({
      ok: true,
      issues: [],
      discardedEquipmentCount: 0,
    })
  })

  it('save sau thao tác đại diện (material vào túi) vẫn nguyên shape', () => {
    const gameManager = createBootedGameManager()

    gameManager.materialBag.add(TEST_MATERIAL, 42)

    const player = createDefaultPlayer()

    const save = buildGameSave(player, gameManager)
    const roundTripped: unknown = JSON.parse(JSON.stringify(save))

    const result = validateGameSaveShape(roundTripped)

    expect(result).toMatchObject({ ok: true, issues: [], discardedEquipmentCount: 0 })

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

    expect(validateGameSaveShape(roundTripped)).toMatchObject({
      ok: true,
      issues: [],
      discardedEquipmentCount: 0,
    })

    const playerData = (roundTripped as { player: typeof player }).player

    expect(playerData.openedMeridianIds).toEqual(['nham_mach', 'doi_mach'])
    expect(playerData.luyenKhiKillsSinceBeast).toBe(500)
    expect(playerData.mortalPerfectionAchieved).toBe(true)
    expect(playerData.greatDaoOpportunityLost).toBe(false)
  })

  it('save có equipment schema mới round-trip qua validator', () => {
    const gameManager = createBootedGameManager()
    const player = createDefaultPlayer()
    const instance: EquipmentInstance = {
      instanceId: 'round-trip-equipment',
      itemId: 'round-trip-sword',
      slot: 'weapon',
      equipped: false,
      grade: 'cuu_pham',
      quality: 'hoang',
      forgeUsesTotal: 6,
      forgeUsesRemaining: 4,
      mainStat: {
        id: 'round-trip-main-stat',
        sourceId: 'round-trip-sword',
        sourceType: 'equipment',
        stat: 'attack',
        flat: 2,
      },
      affixes: [],
    }

    gameManager.equipmentBag.add(instance)

    const roundTripped: unknown = JSON.parse(JSON.stringify(buildGameSave(player, gameManager)))
    const result = validateGameSaveShape(roundTripped)

    expect(result).toMatchObject({ ok: true, issues: [], discardedEquipmentCount: 0 })
    if (result.ok) {
      expect(normalizedSaveOf(result).equipment).toEqual([instance])
    }
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'affix value không hữu hạn %s serialize thành null nhưng current save vẫn bị từ chối',
    (invalidValue) => {
      const gameManager = createBootedGameManager()
      const player = createDefaultPlayer()
      const instance: EquipmentInstance = {
        instanceId: 'invalid-affix-round-trip',
        itemId: 'round-trip-sword',
        slot: 'weapon',
        equipped: false,
        grade: 'cuu_pham',
        quality: 'hoang',
        forgeUsesTotal: 5,
        forgeUsesRemaining: 5,
        mainStat: {
          id: 'invalid-affix-main-stat',
          sourceId: 'invalid-affix-round-trip',
          sourceType: 'equipment',
          stat: 'attack',
          flat: 2,
        },
        affixes: [{ affixId: 'prefix_attack', tier: 2, value: invalidValue }],
      }
      gameManager.equipmentBag.add(instance)

      const roundTripped = JSON.parse(JSON.stringify(buildGameSave(player, gameManager))) as {
        equipment: Array<{ affixes: Array<{ value: unknown }> }>
      }
      expect(roundTripped.equipment[0]!.affixes[0]!.value).toBeNull()

      const result = validateGameSaveShape(roundTripped)
      expect(result.ok).toBe(false)
      expect(result.issues.map((issue) => issue.path)).toContain(
        'equipment[0].affixes[0].value',
      )
    },
  )

  it.each([
    ['equipment entry', 'equipment'],
    ['equipmentSlots entry', 'equipmentSlots'],
  ] as const)('%s có slot lạ bị từ chối sau JSON round-trip', (_case, collection) => {
    const gameManager = createBootedGameManager()
    const player = createDefaultPlayer()
    const instance: EquipmentInstance = {
      instanceId: 'invalid-slot-round-trip',
      itemId: 'round-trip-sword',
      slot: 'weapon',
      equipped: false,
      grade: 'cuu_pham',
      quality: 'hoang',
      forgeUsesTotal: 6,
      forgeUsesRemaining: 6,
      mainStat: {
        id: 'invalid-slot-main-stat',
        sourceId: 'invalid-slot-round-trip',
        sourceType: 'equipment',
        stat: 'attack',
        flat: 2,
      },
      affixes: [],
    }
    gameManager.equipmentBag.add(instance)

    const roundTripped = JSON.parse(JSON.stringify(buildGameSave(player, gameManager))) as {
      equipment: Array<{ slot: unknown }>
      equipmentSlots: Array<{ slot: unknown }>
    }
    roundTripped[collection][0]!.slot = 'not-an-equipment-slot'

    const result = validateGameSaveShape(roundTripped)

    expect(result.ok).toBe(false)
    expect(result.issues.map((issue) => issue.path)).toContain(`${collection}[0].slot`)
  })
})
