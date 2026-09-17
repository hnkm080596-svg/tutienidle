import type { PlayerData } from '../player/Player'
import { REALM_PASSIVES } from '../../data/realm/RealmPassives'

/**
 * Grants the Realm Passive (Nhap Dao/Kien Co/...) of realm `realmId`
 * when a definition exists AND it was never granted to this character -
 * idempotent, the same pattern as GameManager.syncRealmPassive()
 * (skill passive). Safe to call repeatedly at every breakthrough.
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
