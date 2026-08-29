import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import type { PlayerData } from '../player/Player'
import {
  SPIRIT_STONE_MATERIAL,
  SPIRIT_STONE_MATERIAL_ID,
  SPIRIT_STONE_TRUNG_PHAM_MATERIAL,
  SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID,
} from '../material/SpiritStoneMaterial'
import {
  TU_LINH_TRAN_BUFF_PERCENT,
  TU_LINH_TRAN_DURATION_MS,
  TU_LINH_TRAN_EFFECT_GROUP,
  getTuLinhTranCost,
} from '../economy/TuLinhTranBalance'

function setup(playerOverrides: Partial<PlayerData> = {}) {
  const gameManager = new GameManager()

  gameManager.registerMaterials([SPIRIT_STONE_MATERIAL, SPIRIT_STONE_TRUNG_PHAM_MATERIAL])

  const player = createDefaultPlayer()

  Object.assign(player, playerOverrides)

  return { gameManager, player }
}

describe('GameManager.activateTuLinhTran — economy-fixes-sinks-plan §3.2 B1', () => {
  it('không đủ Linh Thạch → từ chối với missing_spirit_stone, KHÔNG trừ gì', () => {
    const { gameManager, player } = setup()

    gameManager.materialBag.add(SPIRIT_STONE_MATERIAL, 10)

    const result = gameManager.activateTuLinhTran(player)

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('missing_spirit_stone')
    expect(gameManager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(10)
    expect(player.persistentTimedEffects).toHaveLength(0)
  })

  it('kích hoạt thành công: trừ đúng cost, thêm effect buff tu luyện đúng hạn', () => {
    const { gameManager, player } = setup()

    player.realmId = 'foundation_establishment'

    gameManager.materialBag.add(SPIRIT_STONE_MATERIAL, 10_000)

    const now = 1_000_000
    const cost = getTuLinhTranCost(player.realmId, 0)

    const result = gameManager.activateTuLinhTran(player, now)

    expect(result.ok).toBe(true)
    expect(gameManager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(10_000 - cost.amount)
    expect(player.persistentTimedEffects).toHaveLength(1)

    const effect = player.persistentTimedEffects[0]!

    expect(effect.effectGroup).toBe(TU_LINH_TRAN_EFFECT_GROUP)
    expect(effect.cultivationSpeedPercent).toBe(TU_LINH_TRAN_BUFF_PERCENT)
    expect(effect.appliedAtMs).toBe(now)
    expect(effect.expiresAtMs).toBe(now + TU_LINH_TRAN_DURATION_MS)
    expect(effect.modifiers).toEqual([])
  })

  it('đang có effect active → cost leo thang theo activeStacks', () => {
    const { gameManager, player } = setup()

    player.realmId = 'foundation_establishment'

    gameManager.materialBag.add(SPIRIT_STONE_MATERIAL, 1_000_000)

    const now = 1_000_000

    expect(gameManager.activateTuLinhTran(player, now).ok).toBe(true)

    const costAfterFirst = getTuLinhTranCost(player.realmId, 1)
    const balanceBeforeSecond = gameManager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)

    expect(gameManager.activateTuLinhTran(player, now).ok).toBe(true)

    expect(gameManager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(
      balanceBeforeSecond - costAfterFirst.amount,
    )

    // Stack policy MVP (refresh cùng group) — vẫn CHỈ 1 effect, deadline
    // được refresh về now + duration.
    expect(player.persistentTimedEffects).toHaveLength(1)
    expect(player.persistentTimedEffects[0]!.expiresAtMs).toBe(now + TU_LINH_TRAN_DURATION_MS)
  })

  it('effect hết hạn → không còn tính vào activeStacks, cost về baseline', () => {
    const { gameManager, player } = setup()

    player.realmId = 'foundation_establishment'

    gameManager.materialBag.add(SPIRIT_STONE_MATERIAL, 1_000_000)

    const now = 1_000_000

    expect(gameManager.activateTuLinhTran(player, now).ok).toBe(true)

    // Đủ lâu để effect đầu hết hạn.
    const afterExpiry = now + TU_LINH_TRAN_DURATION_MS + 1

    gameManager.tickTimedEffects(player, afterExpiry)

    expect(player.persistentTimedEffects).toHaveLength(0)

    const baselineCost = getTuLinhTranCost(player.realmId, 0)
    const balanceBefore = gameManager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)

    const result = gameManager.activateTuLinhTran(player, afterExpiry)

    expect(result.ok).toBe(true)
    expect(gameManager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(
      balanceBefore - baselineCost.amount,
    )
  })

  it('realm Trung Phẩm (Kim Đan+) → tiêu đúng vật liệu Linh Thạch phẩm đó', () => {
    const { gameManager, player } = setup({ realmId: 'golden_core' })

    gameManager.materialBag.add(SPIRIT_STONE_TRUNG_PHAM_MATERIAL, 10_000)

    const cost = getTuLinhTranCost(player.realmId, 0)

    expect(cost.materialId).toBe(SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID)

    const result = gameManager.activateTuLinhTran(player)

    expect(result.ok).toBe(true)
    expect(gameManager.materialBag.getAmount(SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID)).toBe(
      10_000 - cost.amount,
    )
  })
})
