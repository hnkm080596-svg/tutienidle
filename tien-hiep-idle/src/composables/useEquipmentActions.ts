import { useGameManager, useStateVersion } from './useGameState'
import { usePlayerStore } from '../stores/player'
import { useNotificationStore } from '../stores/notification'

/**
 * Modifier equipment là "tĩnh" (xem ghi chú trong Player.ts/
 * EquipmentSystem.ts) — chỉ đổi khi có hành động rõ ràng, KHÔNG tự
 * gộp mỗi tick. Mọi nơi trong UI gọi equip/unequip/enhance/wash/
 * refine/upgrade đều phải qua đây để đồng bộ player.modifiers ngay
 * sau đó, nếu không finalStats hiển thị sẽ bị lệch so với trang bị
 * thật.
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

  // Beta Phase 4 (Notification/UX) — 7 thao tác "chế tác" (Khí Đường)
  // toast kết quả — equip/unequip KHÔNG toast (đã có phản hồi trực
  // quan tức thời qua paperdoll, toast thêm sẽ gây spam vì đây là
  // thao tác rất thường xuyên).
  function withSyncAndToast(ok: boolean, label: string): boolean {
    if (withSync(ok)) {
      notification.push('upgrade', `${label} thành công`)
    } else {
      notification.push('error', `${label} thất bại`)
    }

    return ok
  }

  return {
    equip: (instanceId: string) => withSync(gameManager.equipItem(instanceId, player.$state)),

    unequip: (instanceId: string) => withSync(gameManager.unequipItem(instanceId)),

    enhance: (instanceId: string) => withSyncAndToast(gameManager.enhanceItem(instanceId, player.$state), 'Cường Hóa'),

    wash: (instanceId: string) => withSyncAndToast(gameManager.washItem(instanceId), 'Tẩy Luyện'),

    refine: (instanceId: string) => withSyncAndToast(gameManager.refineItem(instanceId, player.$state), 'Tinh Luyện'),

    forge: (instanceId: string) => withSyncAndToast(gameManager.forgeItem(instanceId), 'Rèn'),

    upgradeQuality: (instanceId: string) =>
      withSyncAndToast(gameManager.upgradeItemQuality(instanceId), 'Nâng Phẩm'),

    upgradeRealm: (instanceId: string) =>
      withSyncAndToast(gameManager.upgradeItemRealm(instanceId, player.$state), 'Nâng Cảnh Giới'),

    // Core Loop Foundation checklist (Phase 4) — Thêm Dòng/Nâng Cấp
    // Dòng cho Affix (Prefix/Suffix), xem EquipmentSystem.addAffix()/
    // upgradeAffixTier().
    addAffix: (instanceId: string) => withSyncAndToast(gameManager.addEquipmentAffix(instanceId), 'Thêm Dòng'),

    upgradeAffixTier: (instanceId: string, affixIndex: number) =>
      withSyncAndToast(gameManager.upgradeEquipmentAffixTier(instanceId, affixIndex), 'Nâng Cấp Dòng'),
  }
}
