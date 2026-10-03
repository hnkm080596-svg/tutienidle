// CompanionCombat (Companion Roster spec sec5-sec6, 2026-09-05) - dung CombatEntity/
// TurnBattleParticipant TUOI MOI moi tran tu 1 CompanionInstance (du lieu so huu,
// persist) + CompanionDefinition tinh cua no, cung pattern "combat state ephemeral"
// da dung cho enemy. Companion KHONG BAO GIO duoc them vao GameManager.activePlayer
// hay struct nhan vat phuc tap cua PlayerData - day la toan bo be mat tich hop.
import { createBaseStats } from '@/core/stats/StatBlock'
import type { CombatEntity } from '@/core/combat/CombatEntity'
import type { CompanionDefinition, CompanionInstance } from '@/data/companion/Companions'
import { companionStatsAt } from './CompanionProgression'
import { getRealmIndex } from '@/core/realm/realmSystem'

export function companionToCombatEntity(instance: CompanionInstance, definition: CompanionDefinition): CombatEntity {
  // companionStatsAt (companion-gacha Task 2) owns the full stat derivation:
  // base x realm-level growth x constellation multiplier x 'stat' perks.
  const scaled = companionStatsAt(definition, instance)
  const stats = createBaseStats({ ...scaled, evasionRate: 0, dexterity: 0, criticalRate: 0 })

  return {
    id: definition.id,
    name: definition.name,
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: getRealmIndex(instance.realmId),
    x: 0, // se bi ghi de boi vi tri o ma FormationLoadout/DEFAULT resolve cho companion nay (Part C)
    row: 4,
    alive: true,
  }
}
