// PersistentTimedEffect (2026-08-24, resource-professions-rework sec5.4) -
// modifier song theo THOI GIAN THUC voi deadline TUYET DOI:
// - `expiresAtMs` la AUTHORITY; moi noi khac (UI countdown) chi suy ra
//   remaining - dong game/offline van lam thoi han troi qua.
// - KHONG bao gio vao CombatEntity.baseStats (tranh buff het han ma stat
//   bi dong bang den het tran) - combat recompute nhan qua provider tu
//   GameManager moi tick (xem BattleSystem.updateStatsFromModifiers()).
// - Save trong player.persistentTimedEffects; load bo effect da het han.
import type { StatModifier } from '../stats/StatCalculator'

export interface PersistentTimedEffect {
  id: string

  sourceItemId: string

  /**
   * Nhom stack (vd 'pill_regen') - uong lai cung nhom: refresh deadline
   * (max) va giu gia tri manh hon, KHONG cong don (stack policy MVP).
   */
  effectGroup?: string

  durationStackable?: boolean

  appliedAtMs: number

  expiresAtMs: number

  modifiers: StatModifier[]

  /**
   * economy-fixes-sinks-plan sec3.2 B1 (2026-08-29) - Tu Linh Tran: % toc
   * do tu luyen tam thoi. KHONG phai StatModifier (toc do tu luyen khong
   * con la stat pipeline - read rieng o stores/player.ts's cultivate()).
   * undefined = effect nay khong buff tu luyen.
   */
  cultivationSpeedPercent?: number
}
