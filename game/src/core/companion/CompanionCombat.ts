// CompanionCombat (Companion Roster spec §5-§6, 2026-09-05) — dựng CombatEntity/
// TurnBattleParticipant TƯƠI MỚI mỗi trận từ 1 CompanionInstance (dữ liệu sở hữu,
// persist) + CompanionDefinition tĩnh của nó, cùng pattern "combat state ephemeral"
// đã dùng cho enemy. Companion KHÔNG BAO GIỜ được thêm vào GameManager.activePlayer
// hay struct nhân vật phức tạp của PlayerData — đây là toàn bộ bề mặt tích hợp.
import { createBaseStats } from '@/core/stats/StatBlock'
import type { CombatEntity } from '@/core/combat/CombatEntity'
import type { CompanionBaseStats, CompanionDefinition, CompanionInstance } from '@/data/companion/Companions'

/**
 * Scale tuyến tính, đường cong chính xác để dành cho pass balance sau (spec §6):
 * mỗi level trên 1 cộng thêm 8% base stat. Tách riêng thành hàm pure để việc
 * tune số sau này không đụng vào code tích hợp combat.
 */
const PER_LEVEL_GROWTH = 0.08

export function companionStatsAtLevel(baseStats: CompanionBaseStats, level: number): CompanionBaseStats {
  const multiplier = 1 + (level - 1) * PER_LEVEL_GROWTH

  return {
    maxHp: Math.round(baseStats.maxHp * multiplier),
    attack: Math.round(baseStats.attack * multiplier),
    speed: baseStats.speed, // speed không scale theo level — tránh xáo trộn turn order khi companion lên cấp
  }
}

export function companionToCombatEntity(instance: CompanionInstance, definition: CompanionDefinition): CombatEntity {
  const scaled = companionStatsAtLevel(definition.baseStats, instance.level)
  const stats = { ...createBaseStats(), ...scaled, evasionRate: 0, dexterity: 0, criticalRate: 0 }

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
    currentMomentum: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    timeSinceLastBleedProc: 0,
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
    realmIndex: 0,
    x: 0, // sẽ bị ghi đè bởi vị trí ô mà FormationLoadout/DEFAULT resolve cho companion này (Part C)
    row: 4,
    alive: true,
  }
}
