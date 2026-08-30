import type { ElementType } from './ElementType'

// Trích từ CharacterPanel.vue (2026-08-15, tooltip Tâm Pháp dùng
// chung) — nhãn tiếng Việt cho Ngũ Hành.
export const ELEMENT_LABELS: Record<ElementType, string> = {
  wood: 'Mộc',
  fire: 'Hỏa',
  earth: 'Thổ',
  metal: 'Kim',
  water: 'Thủy',
}

// Màu đặc trưng từng hành — token --el-* (xem assets/theme.css). Trích
// từ CharacterPanel.vue, dùng chung với ElementLoadoutPicker.vue/
// NodeTreePanel.vue (Pháp Tu Redesign, magicpath) để không lặp map.
export const ELEMENT_COLOR_VARS: Record<ElementType, string> = {
  wood: 'var(--el-wood)',
  fire: 'var(--el-fire)',
  earth: 'var(--el-earth)',
  metal: 'var(--el-metal)',
  water: 'var(--el-water)',
}

// Spec 2026-08-30-phap-tu-dao-sac §5 — bỏ Phong/Lôi toàn hệ: thứ tự
// hiển thị chỉ còn đúng 5 hành Ngũ Hành.
export const ELEMENT_ORDER: ElementType[] = ['wood', 'fire', 'earth', 'metal', 'water']
