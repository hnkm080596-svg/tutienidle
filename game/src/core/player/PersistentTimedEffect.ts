// PersistentTimedEffect (2026-08-24, resource-professions-rework §5.4) —
// modifier sống theo THỜI GIAN THỰC với deadline TUYỆT ĐỐI:
// - `expiresAtMs` là AUTHORITY; mọi nơi khác (UI countdown) chỉ suy ra
//   remaining — đóng game/offline vẫn làm thời hạn trôi qua.
// - KHÔNG bao giờ vào CombatEntity.baseStats (tránh buff hết hạn mà stat
//   bị đóng băng đến hết trận) — combat recompute nhận qua provider từ
//   GameManager mỗi tick (xem BattleSystem.updateStatsFromModifiers()).
// - Save trong player.persistentTimedEffects; load bỏ effect đã hết hạn.
import type { StatModifier } from '../stats/StatCalculator'

export interface PersistentTimedEffect {
  id: string

  sourceItemId: string

  /**
   * Nhóm stack (vd 'pill_regen') — uống lại cùng nhóm: refresh deadline
   * (max) và giữ giá trị mạnh hơn, KHÔNG cộng dồn (stack policy MVP).
   */
  effectGroup?: string

  durationStackable?: boolean

  appliedAtMs: number

  expiresAtMs: number

  modifiers: StatModifier[]

  /**
   * economy-fixes-sinks-plan §3.2 B1 (2026-08-29) — Tụ Linh Trận: % tốc
   * độ tu luyện tạm thời. KHÔNG phải StatModifier (tốc độ tu luyện không
   * còn là stat pipeline — read riêng ở stores/player.ts's cultivate()).
   * undefined = effect này không buff tu luyện.
   */
  cultivationSpeedPercent?: number
}
