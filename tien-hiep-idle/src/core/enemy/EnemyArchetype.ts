/**
 * Core Loop Foundation checklist (Mục MONSTER) — nhãn hành vi nhẹ,
 * KHÔNG phải hệ thống AI/behavior-tree đầy đủ (ngoài phạm vi "vertical
 * core loop"). Không khai = 'melee' (hành vi y hệt trước đây — tiến
 * sát rồi đánh ngay, không thay đổi gì cho enemy cũ).
 */
export type EnemyArchetype = 'melee' | 'ranged' | 'caster'
