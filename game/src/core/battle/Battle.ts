import type { CombatEntity } from '../combat/CombatEntity'

import type { BattleState } from './BattleTypes'

import type { EnemySpawnVfxPresetId } from './CombatAction'
import type { GridPosition } from './BattleGrid'

import type { BuffManager } from '../buff/BuffManager'
import type { AilmentManager } from '../ailment/AilmentManager'
import type { LavaZone } from './LavaZone'

/**
 * 1 quái đang sống trong trận — nhiều quái có thể cùng lúc tồn tại
 * (wave spawn, xem GameManager) nên timer/buff/ailment/cờ thưởng
 * phải tách riêng theo từng con, không dùng chung 1 field trên
 * `Battle` như model 1v1 cũ.
 */
export interface BattleEnemy {
  entity: CombatEntity

  attackTimer: number

  buffs: BuffManager

  ailments: AilmentManager

  // Đánh dấu đã cấp reward cho lần chết này — GameManager set sau
  // khi grantBattleRewardIfNeeded() xử lý xong, rồi mới lọc entry
  // này khỏi Battle.enemies (xem GameManager.ts).
  rewardGranted: boolean

  // Core Loop Foundation checklist (Mục MONSTER) — CHỈ archetype
  // 'caster' dùng: đếm ngược "khoảng lặng" trước khi đòn thực sự bắn
  // ra (telegraph), undefined = không đang cast dở. Xem
  // BattleSystem.updateEnemyAttacks().
  castTimer?: number

  // Đột Phá Trúc Cơ (Phase 4) — số phase trong entity.tribulationPhases
  // ĐÃ áp dụng cho quái Kiếp này, runtime-only (không persist, Battle
  // không lưu save) — undefined coi như 0. Xem
  // BattleSystem.updateTribulationPhases().
  appliedTribulationPhaseCount?: number

  // Combat Rework Phase 4 (Boss Mechanics) — entity.enrage đã áp dụng
  // cho quái này chưa, tránh áp lại mỗi tick sau khi elapsedSeconds đã
  // vượt ngưỡng. Xem BattleSystem.updateEnrage().
  enrageApplied?: boolean
}

export interface Battle {
  id: string

  player: CombatEntity

  enemies: BattleEnemy[]

  state: BattleState

  mode?: 'combat' | 'tribulation'

  // Countdown 3 giây trước trận (2026-08-22) — CHỈ có ý nghĩa khi
  // state==='countdown', xem BattleSystem.update(). undefined ở mọi
  // state khác.
  countdownSecondsRemaining?: number

  playerAttackTimer: number

  // Buff/debuff phát sinh TRONG trận (skill debuff lên địch, skill
  // buff lên bản thân, talisman...) — tách khỏi GameManager.buffSystem
  // (buff persistent ngoài trận, ví dụ từ pill). Mỗi quái có buff
  // pool riêng nằm trong BattleEnemy.buffs.
  playerBuffs: BuffManager

  // Ailment (DoT/CC) TRONG trận — cùng cardinality với playerBuffs
  // (mỗi quái có pool riêng trong BattleEnemy.ailments).
  playerAilments: AilmentManager

  // Combat Rework Phase 4 (Boss Mechanics) — tổng giây đã trôi qua kể
  // từ start(), dùng cho Enrage (DPS check). Xem BattleSystem.updateEnrage().
  elapsedSeconds: number

  // Combat Rework Phase 4 (Boss Mechanics) — id Enemy template boss
  // vừa yêu cầu triệu hồi (TribulationPhase.summonEnemyIds) nhưng
  // BattleSystem chưa tự spawn được (không có EnemyTemplates registry
  // — đó là việc của GameManager). GameManager rút hết mảng này mỗi
  // tick rồi spawn thật qua spawnEnemyInto(), xem
  // GameManager.updateBossSummons().
  pendingSummons: string[]

  // Plans/magicpathgeneral Phase 12 (2026-08-21) — Lava Zone, xem
  // LavaZone.ts/BattleSystem.updateLavaZones(). Runtime-only, KHÔNG
  // persist (giống playerBuffs/playerAilments — Battle không lưu save).
  lavaZones: LavaZone[]

  /**
   * Spawn telegraph (2026-08-24) — quái đang chờ hiệu ứng "telegraph →
   * xuất hiện → tham chiến". ĐÂY LÀ TRẠNG THÁI GAMEPLAY THẬT, không chỉ
   * animation: quái trong danh sách này CHƯA nằm trong `enemies` nên
   * không thể bị chọn mục tiêu, không nhận sát thương và không tấn công
   * — người chơi luôn có thời gian cảnh báo công bằng (attackRange quái
   * hiện lớn hơn chiều rộng grid, spawn trong sân có thể đánh ngay sau
   * khi materialize). Xem BattleSystem.queueEnemySpawn()/
   * updatePendingEnemySpawns().
   */
  pendingEnemySpawns: PendingEnemySpawn[]
}

/** 1 lượt spawn đã đặt lịch, đang đếm ngược telegraph. */
export interface PendingEnemySpawn {
  entity: CombatEntity

  /** Ô sẽ materialize — CHÍNH LÀ ô đã resolve, giữ nguyên tới khi hiện. */
  position: GridPosition

  remainingSeconds: number

  totalSeconds: number

  presetId: EnemySpawnVfxPresetId
}
