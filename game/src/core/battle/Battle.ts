import type { CombatEntity } from '../combat/CombatEntity'

import type { BattleState } from './BattleTypes'

import type { EnemySpawnVfxPresetId, PlayerSpawnVfxPresetId } from './CombatAction'
import type { GridPosition } from './BattleGrid'

import type { BuffPool } from '../buff/BuffPool'
import type { LavaZone } from './legacy/LavaZone'
import type { SwordZone } from './legacy/SwordZone'
import type { ArtifactRuntime } from '../artifact/ArtifactRuntime'

/**
 * 1 quái đang sống trong trận — nhiều quái có thể cùng lúc tồn tại
 * (wave spawn, xem GameManager) nên timer/buff/ailment/cờ thưởng
 * phải tách riêng theo từng con, không dùng chung 1 field trên
 * `Battle` như model 1v1 cũ.
 */
export interface BattleEnemy {
  entity: CombatEntity

  attackTimer: number

  buffs: BuffPool

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

  // Combat Balance Pass (2026-08-29, plan §3.6) — counter đòn đánh của
  // quái, tăng dần mỗi lần fireEnemyAttack(), reset khi trận mới bắt đầu.
  // undefined coi như 0. Dùng để chọn action đặc biệt (everyNth) thay vì
  // basic attack. Runtime-only, không persist.
  specialAttackCounter?: number
}

export interface Battle {
  id: string

  player: CombatEntity

  enemies: BattleEnemy[]

  state: BattleState

  // Spec dot-pha-loi-kiep §5.1 — mode 'tribulation' đã dỡ cùng quái
  // Kiếp (TribulationDirector tự chạy vòng lặp riêng, không qua
  // BattleSystem); chỉ còn 'combat'.
  mode?: 'combat'

  // Countdown 3 giây trước trận (2026-08-22) — CHỈ có ý nghĩa khi
  // state==='countdown', xem BattleSystem.update(). undefined ở mọi
  // state khác.
  countdownSecondsRemaining?: number

  // Fix (2026-09-06) — GameManager.getBattle() trả `turnBattle as unknown
  // as Battle` khi có trận turn-based (xem GameManager.ts). Engine đó
  // đếm ngược countdown bằng SỐ LƯỢT pacing (countdownTurnsRemaining,
  // TurnBattleSystem.ts), không phải giây thật như legacy BattleSystem.ts
  // — khai field ở đây để CombatCountdownOverlay.vue đọc được cả 2 shape
  // qua đúng 1 type, không phải cast ngầm.
  countdownTurnsRemaining?: number

  /**
   * Teleport AI (plan §7.3) — internal cooldown (ICD) của Player: đúng
   * 1 giây sau mỗi lần đổi row. Trong ICD Player vẫn cast/đánh mục tiêu
   * đang trong tầm bình thường nhưng KHÔNG được teleport lần nữa.
   */
  playerTeleport: PlayerTeleportState

  /**
   * Player spawn telegraph (plan §5.3) — avatar Player đang chờ hiệu ứng
   * "telegraph → materialize" tại ô (4,1). Contract RIÊNG (không nằm
   * trong pendingEnemySpawns) để không giả danh enemy, không phát
   * `enemy_spawned` và renderer phân biệt preset. undefined = đã
   * materialize hoặc không dùng telegraph.
   */
  pendingPlayerSpawn?: PendingPlayerSpawn

  /**
   * Targetability (plan §5.4) — false khi Player chưa materialize:
   * không thể bị enemy target, không nhận damage và không cast. KHÔNG
   * dùng `alive = false` cho pending spawn vì "chưa xuất hiện" khác
   * "đã chết".
   */
  playerMaterialized: boolean

  // Buff/debuff phát sinh TRONG trận (skill debuff lên địch, skill
  // buff lên bản thân, talisman...) — tách khỏi GameManager.buffSystem
  // (buff persistent ngoài trận, ví dụ từ pill). Mỗi quái có buff
  // pool riêng nằm trong BattleEnemy.buffs.
  playerBuffs: BuffPool

  // Combat Rework Phase 4 (Boss Mechanics) — tổng giây đã trôi qua kể
  // từ start(), dùng cho Enrage (DPS check). Xem BattleSystem.updateEnrage().
  elapsedSeconds: number

  // Combat Rework Phase 4 (Boss Mechanics) — id Enemy template boss
  // vừa yêu cầu triệu hồi (TribulationPhase.summonEnemyIds) nhưng
  // BattleSystem chưa tự spawn được (không có EnemyTemplates registry
  // — đó là việc của GameManager/StageWaveSystem). StageWaveSystem
  // resolveBossSummons() rút hết mảng này mỗi tick rồi đặt lịch spawn
  // telegraph qua queueEnemySpawn() (plan §5.2).
  pendingSummons: string[]

  // Plans/magicpathgeneral Phase 12 (2026-08-21) — Lava Zone, xem
  // LavaZone.ts/BattleSystem.updateLavaZones(). Runtime-only, KHÔNG
  // persist (giống playerBuffs/playerAilments — Battle không lưu save).
  lavaZones: LavaZone[]

  // Task 8 (Kiếm Trận keystone, 2026-08-28) — SwordZone, xem SwordZone.ts/
  // BattleSystem.updateSwordZones(). Runtime-only, KHÔNG persist (cùng
  // cardinality với lavaZones).
  swordZones: SwordZone[]

  /**
   * Spawn telegraph (2026-08-24) — quái đang chờ hiệu ứng "telegraph →
   * xuất hiện → tham chiến". ĐÂY LÀ TRẠNG THÁI GAMEPLAY THẬT, không chỉ
   * animation: quái trong danh sách này CHƯA nằm trong `enemies` nên
   * không thể bị chọn mục tiêu, không nhận sát thương và không tấn công
   * — người chơi luôn có thời gian cảnh báo công bằng (attackRange quái
   * hiện lớn hơn chiều rộng grid, spawn trong sân có thể đánh ngay sau
    * khi materialize). Xem BattleSystem.queueEnemySpawn()/
   * updatePendingSpawns().
   */
  pendingEnemySpawns: PendingEnemySpawn[]

  /**
   * Round-robin scheduler (combat-skill-flow-element-power-dot-plan.md §5)
   * — con trỏ RUNTIME vào vị trí trong mảng getLoadoutEntries() (đã sort
   * theo slotIndex): lần chọn skill kế tiếp duyệt BẮT ĐẦU từ đây, đi hết
   * vòng rồi quay lại; chỉ dời sau khi begin-cast thành công; reset về 0
   * khi bắt đầu trận mới. KHÔNG persist (giống elapsedSeconds).
   */
  nextSkillSlotIndexCursor?: number

  /**
   * Bản Mệnh Pháp Bảo (2026-08-27, foundation-artifact-system-plan.md
   * §11) — snapshot level/grade/path + timer/rotation/ICD RUNTIME-ONLY
   * (không persist, giống elapsedSeconds/lavaZones). undefined = player
   * không có artifact (Kiếm Tu, hoặc Pháp Tu chưa Trúc Cơ) — tick
   * artifact no-op hoàn toàn trong trường hợp đó.
   */
  artifactRuntime?: ArtifactRuntime
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

/** ICD teleport của Player (plan §2.5/§7.3) — 0 = sẵn sàng đổi row. */
export interface PlayerTeleportState {
  remainingSeconds: number
}

/** Telegraph spawn của avatar Player (plan §4.3) — preset riêng. */
export interface PendingPlayerSpawn {
  position: GridPosition
  remainingSeconds: number
  totalSeconds: number
  presetId: PlayerSpawnVfxPresetId
}
