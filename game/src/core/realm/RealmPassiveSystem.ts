import type { PlayerData } from '../player/Player'
import { REALM_PASSIVES } from '../../data/realm/RealmPassives'

/**
 * Cấp Realm Passive (Nhập Đạo/Kiến Cơ/...) của cảnh giới `realmId` nếu
 * có định nghĩa VÀ chưa từng cấp cho nhân vật này — idempotent, giống
 * hệt pattern unlockedRealmEnhancements/GameManager.syncRealmPassive()
 * (skill passive). An toàn gọi lặp lại ở mọi điểm breakthrough.
 */
export function grantRealmPassive(player: PlayerData, realmId: string) {
  if (player.grantedRealmPassiveIds.includes(realmId)) {
    return
  }

  const definition = REALM_PASSIVES.find(passive => passive.id === realmId)

  if (!definition) {
    return
  }

  const modifiers = definition.buildModifiers(player)

  if (modifiers.length === 0) {
    return
  }

  player.modifiers.push(...modifiers)
  player.grantedRealmPassiveIds.push(realmId)
}
