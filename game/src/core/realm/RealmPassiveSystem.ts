import type { PlayerData } from '../player/Player'
import { REALM_PASSIVES } from '../../data/realm/RealmPassives'
import { wasHiddenBreakthrough } from './hidden/HiddenLineage'

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

  // Hidden Perfection Lineage (design 2026-09-23): the realm's entry
  // breakthrough type selects the modifier variant - the persisted
  // hiddenBreakthroughRealmIds record is the sole authority (the
  // commit sites write it BEFORE the passive syncs).
  const hidden = wasHiddenBreakthrough(player, realmId)
  const build = hidden && definition.buildEnhancedModifiers !== undefined
    ? definition.buildEnhancedModifiers
    : definition.buildModifiers

  const modifiers = build(player)

  if (modifiers.length === 0) {
    return
  }

  player.modifiers.push(...modifiers)
  player.grantedRealmPassiveIds.push(realmId)
}
