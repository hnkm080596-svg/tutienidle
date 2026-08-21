import { ref } from 'vue'

// Dạng cũ, DÙNG CHUNG cho tuyệt đại đa số v-tooltip hiện có trong
// game (chỉ tiêu đề + mô tả 1 dòng) — `kind` optional để mọi object
// literal `{ title, description }` sẵn có (hàng chục nơi) vẫn khớp
// union TooltipContent bên dưới mà KHÔNG cần sửa gì.
export interface PlainTooltipContent {
  kind?: 'plain'

  title?: string

  description?: string
}

export interface TooltipStatRow {
  label: string

  value: string
}

export interface TooltipSection {
  label: string

  rows: TooltipStatRow[]
}

// Tooltip Tâm Pháp (2026-08-15, mẫu đầu tiên cho hướng "tooltip có
// cấu trúc theo từng loại item" — làm TỪNG LOẠI một, đủ) — hình +
// nhiều khối chỉ số (Cộng Thêm/Chiến Đấu/Tu Luyện/Đột Phá), builder ở
// TechniqueSlotCard.vue. Loại item khác (Equipment/Pill/...) sẽ thêm
// biến thể riêng vào union này khi tới lượt, theo đúng khuôn.
export interface TechniqueTooltipContent {
  kind: 'technique'

  name: string

  imagePath?: string

  // Pháp Tu Redesign (magicpath) — Tâm Pháp không còn level/maxLevel
  // (không còn cộng chỉ số nên không còn gì để lên cấp).
  levelLabel?: string

  elementLabel?: string

  description?: string

  sections: TooltipSection[]
}

// Tooltip Đan/Phù/Trận (2026-08-15) — 3 loại item CÙNG SHAPE
// (name/image/phamLabel Ngũ Phẩm/description/sections), khác Equipment
// (không có instance state riêng — pill/talisman/formation chỉ là
// template + số lượng trong túi, không roll/enhance/affix như
// EquipmentInstance) nên gộp chung 1 kind union thay vì 3 interface
// riêng, Tooltip.vue render CHUNG 1 nhánh cho cả 3. Builder ở từng
// BagSection tương ứng (PillBagSection.vue/TalismanBagSection.vue/
// FormationBagSection.vue).
export interface GradedItemTooltipContent {
  kind: 'pill' | 'talisman' | 'formation'

  name: string

  imagePath?: string

  phamLabel: string

  // "Sở hữu: N" — CHỈ có ý nghĩa khi hiện trong túi đồ (có bag stack
  // thật), undefined nếu hiện ở nơi khác (vd khi chưa sở hữu cái nào).
  ownedLabel?: string

  description?: string

  sections: TooltipSection[]
}

// Tooltip Equipment (2026-08-15) — loại CUỐI trong đợt "tooltip theo
// từng loại item". KHÁC GradedItemTooltipContent (có instance state
// thật: quality/rarity/affix/enhance/forge, xem
// composables/useEquipmentTooltip.ts's builder) nên tự 1 kind riêng.
export interface EquipmentTooltipContent {
  kind: 'equipment'

  name: string

  imagePath?: string

  slotLabel: string

  qualityLabel: string

  phamLabel: string

  description?: string

  sections: TooltipSection[]
}

// Tooltip Building (Động Phủ UI redesign) — công trình trong Home
// Scene giờ là world object thật (xem components/game/HomeBuildingIcons.vue),
// tooltip cần tên + chức năng + trạng thái xây/cấp cùng khuôn với
// ItemTooltip/SkillTooltip thay vì {title, description} phẳng cũ.
export interface BuildingTooltipContent {
  kind: 'building'

  name: string

  functionLabel?: string

  statusLabel: string
}

export type TooltipContent =
  | PlainTooltipContent
  | TechniqueTooltipContent
  | GradedItemTooltipContent
  | EquipmentTooltipContent
  | BuildingTooltipContent

// State module-level (không phải Pinia) — chỉ 1 tooltip hiển thị
// tại 1 thời điểm trong toàn game, không cần theo dõi lịch sử/persist.
const content = ref<TooltipContent | null>(null)

const position = ref({ x: 0, y: 0 })

// Element đang "sở hữu" tooltip hiện tại — cần để directive tooltip.ts
// tự dọn đúng lúc unmounted() (vd BreakthroughButton biến mất ngay
// giữa lúc đang hover, do v-if tắt khi cultivation reset sau khi
// bấm) mà không vô tình xoá nhầm tooltip của 1 element KHÁC vừa mới
// showTooltip() sau đó (edge case chuột di chuyển rất nhanh).
let ownerElement: HTMLElement | null = null

function showTooltip(value: TooltipContent, event: MouseEvent, owner?: HTMLElement) {
  content.value = value

  position.value = { x: event.clientX, y: event.clientY }

  ownerElement = owner ?? null
}

function moveTooltip(event: MouseEvent) {
  position.value = { x: event.clientX, y: event.clientY }
}

// `owner` optional — truyền vào khi gọi từ unmounted() (dọn "phòng
// hờ" nếu chính element này đang là chủ tooltip), bỏ qua nếu tooltip
// hiện tại đã thuộc về element khác (không xoá nhầm).
function hideTooltip(owner?: HTMLElement) {
  if (owner && ownerElement !== owner) {
    return
  }

  content.value = null

  ownerElement = null
}

export function useTooltip() {
  return { content, position, showTooltip, moveTooltip, hideTooltip }
}
