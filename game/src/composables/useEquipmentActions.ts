import { useGameManager, useStateVersion } from './useGameState'
import { usePlayerStore } from '../stores/player'
import { useActionFeedbackStore } from '../stores/actionFeedback'
import { actionFailureLabel } from '../core/presentation/ActionAvailability'
import type { EquipmentSlot } from '../core/equipment/EquipmentTypes'
import type { RolledAffix } from '../core/equipment/RolledAffix'
import type { RefineValueEntry } from '../core/equipment/EquipmentSystem'

/**
 * Modifier equipment là "tĩnh" (xem ghi chú trong Player.ts/
 * EquipmentSystem.ts) — chỉ đổi khi có hành động rõ ràng, KHÔNG tự
 * gộp mỗi tick. Mọi nơi trong UI gọi equip/unequip/enhance/Tẩy/Tinh/
 * Hóa đều phải qua đây để đồng bộ player.modifiers ngay sau đó.
 *
 * (2026-08-25, resource-professions-rework plan §7) — Khí Đường chỉ còn
 * bốn operation: Cường Hóa (slot), Tẩy Luyện (identity), Tinh Luyện
 * (dòng đủ điều kiện tăng 5–20%, clamp trần tier + khóa), Hóa Luyện
 * (destructive → Tinh Hoa).
 */
export function useEquipmentActions() {
  const gameManager = useGameManager()

  const player = usePlayerStore()

  const { bumpState } = useStateVersion()

  const feedback = useActionFeedbackStore()

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

  // Workstream A §3.3 — thất bại KHÔNG mutate state, thành công/thất bại
  // đều báo qua "Nhật ký thao tác" với lý do đã dịch tiếng Việt cụ thể.
  function withSyncAndResult(result: { ok: boolean; reason?: string }, label: string): boolean {
    if (withSync(result.ok)) {
      feedback.success(`${label} thành công`)
    } else {
      feedback.error(`Không thể ${label}: ${actionFailureLabel(result.reason)}`)
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

        feedback.success(`Hóa Luyện: ${material?.name ?? 'Nguyên liệu không xác định'} ×${reward.amount}`)
      }

      syncEquipmentModifiers()

      bumpState()
    } else if (!result.ok) {
      feedback.error(`Không thể Hóa Luyện: ${actionFailureLabel(result.reason)}`)
    }

    return result.ok
  }

  return {
    equip: (instanceId: string) =>
      withSyncAndResult(gameManager.equipItem(instanceId, player.$state), 'Trang Bị'),

    unequip: (instanceId: string) => withSync(gameManager.unequipItem(instanceId)),

    // Cường Hóa gắn SLOT (slot-level rework) — slot trống vẫn nâng được.
    enhance: (slot: EquipmentSlot) =>
      withSyncAndResult(gameManager.enhanceSlot(slot, player.$state), 'Cường Hóa'),

    /** Tẩy Luyện — tiêu Tinh Hoa, Linh Thạch và một lượt Rèn. */
    wash: (instanceId: string) =>
      withSyncAndResult(gameManager.washItem(instanceId, player.$state), 'Tẩy Luyện'),

    /** Tinh Luyện — lockedIndices là các dòng giữ nguyên (§7.4). */
    refine: (instanceId: string, lockedIndices: readonly number[]) =>
      withSyncAndResult(
        gameManager.refineItem(instanceId, lockedIndices, player.$state),
        'Tinh Luyện',
      ),

    /**
     * Xem trước Tẩy Luyện (2026-08-30, UI "giữ/bỏ") — roll + TRỪ COST NGAY
     * nhưng KHÔNG ghi vào instance; UI giữ affixes trả về ở state tạm rồi
     * gọi washCommit() khi bấm "Giữ". Thất bại (thiếu nguyên liệu...) báo
     * qua Nhật ký thao tác giống mọi action khác — KHÔNG bumpState vì
     * chưa mutate gì nếu fail, có bumpState nếu thành công (cost đã trừ).
     */
    washPreview: (instanceId: string): RolledAffix[] | null => {
      const result = gameManager.previewWashItem(instanceId)

      if (!result.ok || !result.affixes) {
        feedback.error(`Không thể Tẩy Luyện: ${actionFailureLabel(result.reason)}`)

        return null
      }

      syncEquipmentModifiers()

      bumpState()

      return result.affixes
    },

    /** Chốt affixes đã washPreview() — không trừ cost lần nữa. */
    washCommit: (instanceId: string, affixes: RolledAffix[]) =>
      withSyncAndResult(gameManager.commitWashItem(instanceId, affixes), 'Tẩy Luyện'),

    /** Xem trước Tinh Luyện (2026-08-30, UI "giữ/bỏ") — cùng cơ chế washPreview. */
    refinePreview: (instanceId: string, lockedIndices: readonly number[]): RefineValueEntry[] | null => {
      const result = gameManager.previewRefineItem(instanceId, lockedIndices)

      if (!result.ok || !result.values) {
        feedback.error(`Không thể Tinh Luyện: ${actionFailureLabel(result.reason)}`)

        return null
      }

      syncEquipmentModifiers()

      bumpState()

      return result.values
    },

    /** Chốt values đã refinePreview() — không trừ cost lần nữa. */
    refineCommit: (instanceId: string, values: RefineValueEntry[]) =>
      withSyncAndResult(gameManager.commitRefineItem(instanceId, values), 'Tinh Luyện'),

    /** Bỏ preview Refine ở cả UI lẫn capability core; không hoàn lại cost đã roll. */
    refineDiscard: (instanceId?: string) => gameManager.discardRefinePreview(instanceId),

    /** Hóa Luyện batch all-or-nothing (§7.5). */
    dissolve,
  }
}
