import type { ElementType } from './ElementType'

// Trich tu CharacterPanel.vue (2026-08-15, tooltip Tam Phap dung
// chung) - nhan tieng Viet cho Ngu Hanh.
export const ELEMENT_LABELS: Record<ElementType, string> = {
  wood: 'Mộc',
  fire: 'Hỏa',
  earth: 'Thổ',
  metal: 'Kim',
  water: 'Thủy',
}

// Mau dac trung tung hanh - token --el-* (xem assets/theme.css). Trich
// tu CharacterPanel.vue, dung chung voi NodeTreePanel.vue (Phap Tu
// Redesign, magicpath) de khong lap map.
export const ELEMENT_COLOR_VARS: Record<ElementType, string> = {
  wood: 'var(--el-wood)',
  fire: 'var(--el-fire)',
  earth: 'var(--el-earth)',
  metal: 'var(--el-metal)',
  water: 'var(--el-water)',
}

// Spec 2026-08-30-phap-tu-dao-sac sec5 - bo Phong/Loi toan he: thu tu
// hien thi chi con dung 5 hanh Ngu Hanh.
export const ELEMENT_ORDER: ElementType[] = ['wood', 'fire', 'earth', 'metal', 'water']
