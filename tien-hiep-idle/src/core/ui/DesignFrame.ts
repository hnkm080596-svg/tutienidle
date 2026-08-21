// Nguồn DUY NHẤT cho kích thước khung thiết kế 16:9 cố định (xem
// GameRoot.vue) — mọi nơi khác cần biết kích thước panel/frame PHẢI
// import từ đây thay vì tự hardcode lại số, để khi đổi 1 trong các
// hằng số này (vd đổi % chiều rộng panel trái) thì mọi layout dựa
// trên nó (BagGrid, EquipmentPaperdoll...) tự tính lại đúng theo,
// không bị "bẻ" (lệch/tràn) do số liệu rời rạc không đồng bộ.
export const DESIGN_WIDTH = 2560
export const DESIGN_HEIGHT = 1440

export const BOTTOM_BAR_HEIGHT = 72

// UI redesign — DongFuTopBar.vue (Menu/Realm/Resource/Settings), thay
// nút Menu tròn nổi riêng ở RightPanel.vue cũ (đã gỡ, xem GameRoot.vue).
export const TOP_BAR_HEIGHT = 64

export const LEFT_PANEL_WIDTH_PERCENT = 0.25

export const LEFT_PANEL_WIDTH = DESIGN_WIDTH * LEFT_PANEL_WIDTH_PERCENT

export const LEFT_PANEL_HEIGHT = DESIGN_HEIGHT - BOTTOM_BAR_HEIGHT - TOP_BAR_HEIGHT

// Combat UI Redesign — Combat Scene chiếm TOÀN BỘ khung 2560×1440 (đè
// lên cả TOP_BAR_HEIGHT/BOTTOM_BAR_HEIGHT của Động Phủ, xem
// CombatSceneOverlay.vue), tự chia layout riêng theo đúng thứ tự spec
// mục 5/9: Top Bar → Status Bar → Battlefield (phần lớn) → Event Bar →
// Control Bar.
export const COMBAT_TOP_BAR_HEIGHT = 64

export const COMBAT_STATUS_BAR_HEIGHT = 56

export const COMBAT_EVENT_BAR_HEIGHT = 40

export const COMBAT_CONTROL_BAR_HEIGHT = 64
