import { useGameManager, useStateVersion } from './useGameState'
import { usePlayerStore } from '../stores/player'
import { useActionFeedbackStore } from '../stores/actionFeedback'
import { actionFailureKey, ACTION_FAILURE_FALLBACK_KEY } from '../core/presentation/ActionAvailability'
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

  // i18n (task 2.2 lô 1) — composable KHÔNG import i18n: chỉ đẩy locale key
  // vào feedback store, ActionFeedbackLog t() tại điểm render. successKey/
  // errorKey gửi messageKey + params (giá trị param cũng là locale key).
  const OP_LABEL_KEYS = {
    equip: 'actionFeedback.ops.equip.label',
    enhance: 'actionFeedback.ops.enhance.label',
    wash: 'actionFeedback.ops.wash.label',
    refine: 'actionFeedback.ops.refine.label',
    dissolve: 'actionFeedback.ops.dissolve.label',
  } as const

  type OpId = keyof typeof OP_LABEL_KEYS

  function reportFailure(op: OpId, reason: string | undefined) {
    feedback.errorKey('actionFeedback.failed', {
      label: OP_LABEL_KEYS[op],
      reason: actionFailureKey(reason) ?? ACTION_FAILURE_FALLBACK_KEY,
    })
  }

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
  // đều báo qua "Nhật ký thao tác" với lý do đã dịch cụ thể (key + t()).
  function withSyncAndResult(result: { ok: boolean; reason?: string }, op: OpId): boolean {
    if (withSync(result.ok)) {
      feedback.successKey('actionFeedback.success', { label: OP_LABEL_KEYS[op] })
    } else {
      reportFailure(op, result.reason)
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

        // Tên nguyên liệu là data-layer (loạt 2.7) — đẩy chuỗi thường.
        feedback.success(`Hóa Luyện: ${material?.name ?? 'Nguyên liệu không xác định'} ×${reward.amount}`)
      }

      syncEquipmentModifiers()

      bumpState()
    } else if (!result.ok) {
      reportFailure('dissolve', result.reason)
    }

    return result.ok
  }

  return {
    equip: (instanceId: string) =>
      withSyncAndResult(gameManager.equipItem(instanceId, player.$state), 'equip'),

    unequip: (instanceId: string) => withSync(gameManager.unequipItem(instanceId)),

    // Cường Hóa gắn SLOT (slot-level rework) — slot trống vẫn nâng được.
    enhance: (slot: EquipmentSlot) =>
      withSyncAndResult(gameManager.enhanceSlot(slot, player.$state), 'enhance'),

    /** Tẩy Luyện — tiêu Tinh Hoa, Linh Thạch và một lượt Rèn. */
    wash: (instanceId: string) =>
      withSyncAndResult(gameManager.washItem(instanceId, player.$state), 'wash'),

    /** Tinh Luyện — lockedIndices là các dòng giữ nguyên (§7.4). */
    refine: (instanceId: string, lockedIndices: readonly number[]) =>
      withSyncAndResult(gameManager.refineItem(instanceId, lockedIndices, player.$state), 'refine'),

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
        reportFailure('wash', result.reason)

        return null
      }

      syncEquipmentModifiers()

      bumpState()

      return result.affixes
    },

    /** Chốt affixes đã washPreview() — không trừ cost lần nữa. */
    washCommit: (instanceId: string, affixes: RolledAffix[]) =>
      withSyncAndResult(gameManager.commitWashItem(instanceId, affixes), 'wash'),

    /** Xem trước Tinh Luyện (2026-08-30, UI "giữ/bỏ") — cùng cơ chế washPreview. */
    refinePreview: (instanceId: string, lockedIndices: readonly number[]): RefineValueEntry[] | null => {
      const result = gameManager.previewRefineItem(instanceId, lockedIndices)

      if (!result.ok || !result.values) {
        reportFailure('refine', result.reason)

        return null
      }

      syncEquipmentModifiers()

      bumpState()

      return result.values
    },

    /** Chốt values đã refinePreview() — không trừ cost lần nữa. */
    refineCommit: (instanceId: string, values: RefineValueEntry[]) =>
      withSyncAndResult(gameManager.commitRefineItem(instanceId, values), 'refine'),

    /** Bỏ preview Refine ở cả UI lẫn capability core; không hoàn lại cost đã roll. */
    refineDiscard: (instanceId?: string) => gameManager.discardRefinePreview(instanceId),

    /** Hóa Luyện batch all-or-nothing (§7.5). */
    dissolve,
  }
}
