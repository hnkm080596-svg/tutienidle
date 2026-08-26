import { useGameManager, useStateVersion } from './useGameState'
import { usePlayerStore } from '../stores/player'
import { useNotificationStore } from '../stores/notification'
import type { EquipmentSlot } from '../core/equipment/EquipmentTypes'

/**
 * Modifier equipment là "tĩnh" (xem ghi chú trong Player.ts/
 * EquipmentSystem.ts) — chỉ đổi khi có hành động rõ ràng, KHÔNG tự
 * gộp mỗi tick. Mọi nơi trong UI gọi equip/unequip/enhance/Tẩy/Tinh/
 * Hóa đều phải qua đây để đồng bộ player.modifiers ngay sau đó.
 *
 * (2026-08-25, resource-professions-rework plan §7) — Khí Đường chỉ còn
 * bốn operation: Cường Hóa (slot), Tẩy Luyện (identity), Tinh Luyện
 * (±20% + khóa), Hóa Luyện (destructive → Tinh Hoa).
 */
export function useEquipmentActions() {
  const gameManager = useGameManager()

  const player = usePlayerStore()

  const { bumpState } = useStateVersion()

  const notification = useNotificationStore()

  function syncEquipmentModifiers() {
    player.setEquipmentModifiers(gameManager.getEquipmentModifiers())
  }

  function withSync(ok: boolean): boolean {
    if (ok) {
      syncEquipmentModifiers()

      bumpState()
    }

    return ok
  }

  function withSyncAndResult(result: { ok: boolean; reason?: string }, label: string): boolean {
    if (withSync(result.ok)) {
      notification.push('upgrade', `${label} thành công`)
    } else {
      notification.push('error', `${label} thất bại (${result.reason ?? 'unknown'})`)
    }

    return result.ok
  }

  function dissolve(instanceIds: readonly string[]): boolean {
    const result = gameManager.dissolveItems(instanceIds)

    if (result.ok && result.rewards) {
      for (const reward of result.rewards) {
        const material = gameManager.materialRegistry.has(reward.materialId)
          ? gameManager.materialRegistry.get(reward.materialId)
          : undefined

        notification.push(
          'upgrade',
          `Hóa Luyện: ${material?.name ?? reward.materialId} ×${reward.amount}`,
        )
      }

      syncEquipmentModifiers()

      bumpState()
    } else if (!result.ok) {
      notification.push('error', `Hóa Luyện thất bại (${result.reason ?? 'unknown'})`)
    }

    return result.ok
  }

  return {
    equip: (instanceId: string) => withSync(gameManager.equipItem(instanceId, player.$state)),

    unequip: (instanceId: string) => withSync(gameManager.unequipItem(instanceId)),

  // Cường Hóa gắn SLOT (slot-level rework) — slot trống vẫn nâng được.
  enhance: (slot: EquipmentSlot) =>
    withSync(gameManager.enhanceSlot(slot, player.$state))
        ? (notification.push('upgrade', 'Cường Hóa thành công'), true)
        : (notification.push('error', 'Cường Hóa thất bại'), false),

    /** Tẩy Luyện — oreMaterialId phải cùng cảnh giới item (§7.3). */
    wash: (instanceId: string, oreMaterialId: string) =>
      withSyncAndResult(
        gameManager.washItem(instanceId, oreMaterialId, player.$state),
        'Tẩy Luyện',
      ),

    /** Tinh Luyện — lockedIndices là các dòng giữ nguyên (§7.4). */
    refine: (instanceId: string, lockedIndices: readonly number[]) =>
      withSyncAndResult(
        gameManager.refineItem(instanceId, lockedIndices, player.$state),
        'Tinh Luyện',
      ),

    /** Hóa Luyện batch all-or-nothing (§7.5). */
    dissolve,
  }
}
