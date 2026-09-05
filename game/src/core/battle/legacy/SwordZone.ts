import type { ElementType } from '../../element/ElementType'

/**
 * Task 8 (Kiếm Trận keystone, 2026-08-28) — clone của LavaZone.ts nhưng
 * CHARGE-BASED thay vì time-based: zone tồn tại độc lập theo VỊ TRÍ
 * (row/column, không gắn entity), damage đi qua ĐÚNG pipeline
 * CombatSystem.applyDotDamage() như Lava Zone — nhưng hết hạn sau
 * `remainingCharges` LẦN TICK ĐÃ TRÔI (BattleSystem.updateSwordZones()'s
 * while loop), không phải sau N giây. Khác LavaZone: KHÔNG spawn qua
 * ReactionManager — spawn trực tiếp từ SkillEffectSystem's case 'damage'
 * (xem SkillEffect.grantsSwordZone), element luôn 'metal' (Kiếm Trận).
 */
export interface SwordZone {
  id: string

  // Entity đã kích hoạt skill sinh ra zone — dùng để xác định "phe
  // đối lập" (entity nào bị tick trúng).
  ownerId: string

  // Vị trí grid của tâm zone (Combat Grid Rework).
  row: number

  column: number

  laneRadius: number

  columnRadius: number

  remainingCharges: number

  tickInterval: number

  // Giây đã trôi qua kể từ tick gần nhất — dùng vòng lặp while ở
  // BattleSystem.updateSwordZones() để bắt kịp nếu 1 tick deltaSeconds
  // bất thường lớn hơn tickInterval (cùng gotcha đã gặp ở Lava Zone/Kim
  // Thế decay).
  timeSinceLastTick: number

  damagePerTick: number

  // Kiếm Trận LUÔN metal — không nhận từ spec (khác LavaZone), gán cứng
  // ở BattleSystem.spawnSwordZone().
  element: ElementType | 'physical'
}
