// Nguon DUY NHAT cho kich thuoc khung thiet ke 16:9 co dinh (xem
// GameRoot.vue) - moi noi khac can biet kich thuoc panel/frame PHAI
// import tu day thay vi tu hardcode lai so, de khi doi 1 trong cac
// hang so nay (vd doi % chieu rong panel trai) thi moi layout dua
// tren no (BagGrid, EquipmentPaperdoll...) tu tinh lai dung theo,
// khong bi "be" (lech/tran) do so lieu roi rac khong dong bo.
export const DESIGN_WIDTH = 2560
export const DESIGN_HEIGHT = 1440

export const BOTTOM_BAR_HEIGHT = 72

// UI redesign - thanh top bar DOM (Menu/Realm/Resource/Settings), thay
// nut Menu tron noi rieng o RightPanel.vue cu (da go, xem GameRoot.vue).
export const TOP_BAR_HEIGHT = 64

export const LEFT_PANEL_WIDTH_PERCENT = 0.25

export const LEFT_PANEL_WIDTH = DESIGN_WIDTH * LEFT_PANEL_WIDTH_PERCENT

export const LEFT_PANEL_HEIGHT = DESIGN_HEIGHT - BOTTOM_BAR_HEIGHT - TOP_BAR_HEIGHT

// ui-discoverability-refactor-plan.md sec3.3 (2026-08-29) - cac hang
// COMBAT_TOP_BAR_HEIGHT / COMBAT_STATUS_BAR_HEIGHT / COMBAT_EVENT_BAR_HEIGHT /
// COMBAT_CONTROL_BAR_HEIGHT DA XOA: nguon su that cho chrome combat la DOM
// do that (getCombatInsets/setCombatInsets - xem src/presentation/geometry/combatInsets.ts,
// khop CSS clamp() --combat-*-h trong theme.css); fallback ti le nam o
// getFallbackCombatInsets() trong cung module, KHONG con o day.
