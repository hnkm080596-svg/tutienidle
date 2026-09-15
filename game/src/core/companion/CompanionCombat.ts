// CompanionCombat (Companion Roster spec §5-§6, 2026-09-05) - dựng CombatEntity/
// TurnBattleParticipant TƯƠI MỚI mỗi trận từ 1 CompanionInstance (dữ liệu sở hữu,
// persist) + CompanionDefinition tĩnh của nó, cùng pattern "combat state ephemeral"
// đã dùng cho enemy. Companion KHÔNG BAO GIỜ được thêm vào GameManager.activePlayer
// hay struct nhân vật phức tạp của PlayerData - đây là toàn bộ bề mặt tích hợp.
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
    currentSwordIntent: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    timeSinceLastBleedProc: 0,
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: getRealmIndex(instance.realmId),
    x: 0, // sẽ bị ghi đè bởi vị trí ô mà FormationLoadout/DEFAULT resolve cho companion này (Part C)
    row: 4,
    alive: true,
  }
}
