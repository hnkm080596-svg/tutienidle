import type { ElementType } from '../element/ElementType'

/**
 * Plans/magicpathgeneral Phase 12 (2026-08-21) — "Lava Zone không phải
 * DoT trên target. Nó là: Skill → capture target position → spawn
 * Lava VFX → spawn hit area." Vùng sát thương tồn tại ĐỘC LẬP theo VỊ
 * TRÍ (x, chỉ 1 chiều ngang — xem CombatEntity.x's ghi chú "sân đấu
 * không có trục Y"), KHÔNG gắn với bất kỳ entity nào — khác hẳn
 * Ailment (luôn có targetId cố định). Bất kỳ entity phe đối lập
 * `ownerId` nào đứng trong bán kính lúc tick đều bị trúng, kể cả
 * entity spawn SAU khi zone đã tồn tại. Damage đi qua ĐÚNG pipeline
 * CombatSystem.applyDotDamage() (DOT RES/Poison Recovery/DamageEvent)
 * — "Không để Phaser animation quyết định damage": state này thuần
 * core, KHÔNG phụ thuộc Phaser/view nào (view muốn vẽ VFX riêng thì tự
 * lắng nghe 'positions'/spawn event tương ứng, tách biệt hoàn toàn
 * khỏi state damage ở đây).
 */
export interface LavaZone {
  id: string

  // Entity đã kích hoạt Reaction sinh ra zone — dùng để xác định "phe
  // đối lập" (entity nào bị tick trúng), KHÔNG phải target ban đầu bị
  // Reaction áp — zone tồn tại độc lập với target đó sau khi spawn.
  ownerId: string

  // Vị trí grid của tâm zone (Combat Grid Rework).
  row: number

  column: number

  laneRadius: number

  columnRadius: number

  remainingTime: number

  tickInterval: number

  // Giây đã trôi qua kể từ tick gần nhất — dùng vòng lặp while ở
  // BattleSystem.updateLavaZones() để bắt kịp nếu 1 tick deltaSeconds
  // bất thường lớn hơn tickInterval (cùng gotcha đã gặp ở Kim Thế
  // decay, xem [[tienhiep-kimpath-kim]]).
  timeSinceLastTick: number

  damagePerTick: number

  element: ElementType | 'physical'
}
